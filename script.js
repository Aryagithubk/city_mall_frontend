// Configuration
const API_BASE_URL = "http://localhost:8000/api";
let socket = null;
let currentUser = "netrunnerX";
let disasters = [];

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initializeWebSocket();
  setupEventListeners();
  loadDisasters();
});

// WebSocket Connection
function initializeWebSocket() {
  socket = io("http://localhost:8000");

  socket.on("connect", () => {
    console.log("Connected to server");
    updateConnectionStatus(true);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
    updateConnectionStatus(false);
  });

  socket.on("disaster_updated", (data) => {
    console.log("Disaster updated:", data);
    loadDisasters();
    updateLastUpdate();
  });

  socket.on("social_media_updated", (data) => {
    console.log("Social media updated:", data);
    if (data.disaster_id) {
      loadSocialMediaForDisaster(data.disaster_id);
    }
    updateLastUpdate();
  });

  socket.on("resources_updated", (data) => {
    console.log("Resources updated:", data);
    loadResources();
    updateLastUpdate();
  });
}

// Event Listeners
function setupEventListeners() {
  // User selection
  document.getElementById("userSelect").addEventListener("change", (e) => {
    currentUser = e.target.value;
    console.log("User changed to:", currentUser);
  });

  // Disaster form
  document
    .getElementById("disasterForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await createDisaster();
    });

  // Report form
  document
    .getElementById("reportForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await submitReport();
    });

  // Geocode form
  document
    .getElementById("geocodeForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await testGeocoding();
    });
}

// API Functions
async function apiCall(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-user-id": currentUser,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    showError(error.message);
    throw error;
  }
}

// Disaster Functions
async function createDisaster() {
  const form = document.getElementById("disasterForm");
  const formData = {
    title: document.getElementById("title").value,
    location_name: document.getElementById("locationName").value,
    description: document.getElementById("description").value,
    tags: document
      .getElementById("tags")
      .value.split(",")
      .map((t) => t.trim())
      .filter((t) => t),
  };

  try {
    const disaster = await apiCall("/disasters", {
      method: "POST",
      body: JSON.stringify(formData),
    });

    showSuccess("Disaster created successfully!");
    form.reset();

    // Geocode the location if available
    if (formData.location_name || formData.description) {
      await apiCall("/geocode", {
        method: "POST",
        body: JSON.stringify({
          disaster_id: disaster.id,
          location_name: formData.location_name,
          description: formData.description,
        }),
      });
    }
  } catch (error) {
    showError("Failed to create disaster");
  }
}

async function loadDisasters() {
  try {
    disasters = await apiCall("/disasters");
    displayDisasters();
    updateDisasterSelect();
  } catch (error) {
    console.error("Failed to load disasters:", error);
  }
}

function displayDisasters() {
  const container = document.getElementById("disastersList");
  container.innerHTML = "";

  disasters.forEach((disaster) => {
    const item = document.createElement("div");
    item.className = "disaster-item";

    const tags = disaster.tags
      ? disaster.tags
          .map(
            (tag) =>
              `<span class="tag ${
                tag === "urgent" ? "urgent" : ""
              }">${tag}</span>`
          )
          .join("")
      : "";

    item.innerHTML = `
            <h3>${disaster.title}</h3>
            <div class="disaster-meta">
                <strong>Location:</strong> ${
                  disaster.location_name || "Unknown"
                }<br>
                <strong>Owner:</strong> ${disaster.owner_id}<br>
                <strong>Created:</strong> ${new Date(
                  disaster.created_at
                ).toLocaleString()}
            </div>
            <p>${disaster.description}</p>
            <div class="tags">${tags}</div>
            <div class="actions">
                <button onclick="loadSocialMediaForDisaster('${
                  disaster.id
                }')" class="btn-secondary">
                    Load Social Media
                </button>
                <button onclick="loadResourcesForDisaster('${
                  disaster.id
                }')" class="btn-secondary">
                    Load Resources
                </button>
                <button onclick="loadOfficialUpdates('${
                  disaster.id
                }')" class="btn-secondary">
                    Official Updates
                </button>
                ${
                  currentUser === disaster.owner_id ||
                  currentUser === "netrunnerX"
                    ? `<button onclick="deleteDisaster('${disaster.id}')" class="btn-danger">Delete</button>`
                    : ""
                }
            </div>
        `;

    container.appendChild(item);
  });
}

function updateDisasterSelect() {
  const select = document.getElementById("disasterId");
  select.innerHTML = '<option value="">Select Disaster</option>';

  disasters.forEach((disaster) => {
    const option = document.createElement("option");
    option.value = disaster.id;
    option.textContent = disaster.title;
    select.appendChild(option);
  });
}

async function deleteDisaster(id) {
  if (!confirm("Are you sure you want to delete this disaster?")) return;

  try {
    await apiCall(`/disasters/${id}`, { method: "DELETE" });
    showSuccess("Disaster deleted successfully");
  } catch (error) {
    showError("Failed to delete disaster");
  }
}

// Report Functions
async function submitReport() {
  const form = document.getElementById("reportForm");
  const disasterId = document.getElementById("disasterId").value;

  if (!disasterId) {
    showError("Please select a disaster");
    return;
  }

  const reportData = {
    content: document.getElementById("reportContent").value,
    image_url: document.getElementById("imageUrl").value,
  };

  try {
    // In a real implementation, this would create a report
    // For now, we'll just verify the image if provided
    if (reportData.image_url) {
      await apiCall(`/disasters/${disasterId}/verify-image`, {
        method: "POST",
        body: JSON.stringify({ image_url: reportData.image_url }),
      });
    }

    showSuccess("Report submitted successfully!");
    form.reset();
  } catch (error) {
    showError("Failed to submit report");
  }
}

// Social Media Functions
async function loadSocialMediaForDisaster(disasterId) {
  try {
    const posts = await apiCall(`/disasters/${disasterId}/social-media`);
    displaySocialMedia(posts);
  } catch (error) {
    console.error("Failed to load social media:", error);
  }
}

function displaySocialMedia(posts) {
  const container = document.getElementById("socialMediaFeed");
  container.innerHTML = "<h3>Recent Social Media Posts</h3>";

  if (!posts || posts.length === 0) {
    container.innerHTML += "<p>No social media posts found</p>";
    return;
  }

  posts.forEach((post) => {
    const item = document.createElement("div");
    item.className = "social-post";
    item.innerHTML = `
            <div class="username">@${post.user}</div>
            <div class="content">${post.post}</div>
            <div class="timestamp">${new Date(
              post.timestamp
            ).toLocaleString()}</div>
        `;
    container.appendChild(item);
  });
}

// Resources Functions
async function loadResourcesForDisaster(disasterId) {
  try {
    // Using mock coordinates for demo
    const resources = await apiCall(
      `/disasters/${disasterId}/resources?lat=40.7128&lon=-74.0060&radius=10000`
    );
    displayResources(resources);
  } catch (error) {
    console.error("Failed to load resources:", error);
  }
}

async function loadResources() {
  // Load resources for all disasters
  if (disasters.length > 0) {
    loadResourcesForDisaster(disasters[0].id);
  }
}

function displayResources(resources) {
  const container = document.getElementById("resourcesList");
  container.innerHTML = "";

  if (!resources || resources.length === 0) {
    container.innerHTML = "<p>No resources found nearby</p>";
    return;
  }

  resources.forEach((resource) => {
    const item = document.createElement("div");
    item.className = "resource-item";
    item.innerHTML = `
            <strong>${resource.name}</strong><br>
            <small>Location: ${resource.location_name || "Unknown"}</small><br>
            <span class="resource-type">${resource.type}</span>
        `;
    container.appendChild(item);
  });
}

// Official Updates Functions
async function loadOfficialUpdates(disasterId) {
  try {
    const updates = await apiCall(`/disasters/${disasterId}/official-updates`);
    displayOfficialUpdates(updates);
  } catch (error) {
    console.error("Failed to load official updates:", error);
  }
}

function displayOfficialUpdates(updates) {
  const container = document.getElementById("officialUpdates");
  container.innerHTML = "";

  if (!updates || updates.length === 0) {
    container.innerHTML = "<p>No official updates available</p>";
    return;
  }

  updates.forEach((update) => {
    const item = document.createElement("div");
    item.className = "update-item";
    item.innerHTML = `
            <div class="update-source">${update.source}</div>
            <strong>${update.title}</strong><br>
            <p>${update.content}</p>
            <small>${new Date(update.timestamp).toLocaleString()}</small>
        `;
    container.appendChild(item);
  });
}

// Geocoding Test
async function testGeocoding() {
  const description = document.getElementById("geocodeDescription").value;
  const resultDiv = document.getElementById("geocodeResult");

  try {
    const result = await apiCall("/geocode", {
      method: "POST",
      body: JSON.stringify({ description }),
    });

    resultDiv.innerHTML = `
            <strong>Extracted Location:</strong> ${result.location_name}<br>
            <strong>Coordinates:</strong> ${result.coordinates.lat}, ${result.coordinates.lng}<br>
            <strong>Formatted Address:</strong> ${result.formatted_address}
        `;
    resultDiv.classList.add("show");
  } catch (error) {
    showError("Geocoding failed");
  }
}

// UI Helper Functions
function updateConnectionStatus(connected) {
  const status = document.getElementById("connectionStatus");
  status.textContent = connected ? "Connected" : "Disconnected";
  status.className = connected ? "connected" : "";
}

function updateLastUpdate() {
  document.getElementById(
    "lastUpdate"
  ).textContent = `Last update: ${new Date().toLocaleTimeString()}`;
}

function showError(message) {
  alert(`Error: ${message}`);
}

function showSuccess(message) {
  alert(`Success: ${message}`);
}
