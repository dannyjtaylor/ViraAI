const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const micBtn = document.getElementById("mic-btn");
const chatContainer = document.getElementById("chat-container");
const typingIndicator = document.getElementById("typing-indicator");
const themeToggle = document.getElementById("theme-toggle");
const resetBtn = document.getElementById("reset-btn");

sendBtn.addEventListener("click", sendMessage);
themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
});
resetBtn.addEventListener("click", clearMemory);

userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});

function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage(content, sender, animate = false) {
    const message = document.createElement("div");
    message.classList.add("message", sender);

    const bubble = document.createElement("div");
    bubble.classList.add("bubble");

    const time = document.createElement("div");
    time.classList.add("timestamp");
    time.textContent = formatTime();

    message.appendChild(bubble);
    message.appendChild(time);
    chatContainer.appendChild(message);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    if (animate && sender === "vira") {
        let index = 0;
        const typingSpeed = 10;
        const interval = setInterval(() => {
            bubble.innerHTML = content.slice(0, index) + "<span class='cursor'>|</span>";
            index++;
            if (index > content.length) {
                clearInterval(interval);
                bubble.innerHTML = content;
                saveChat();
            }
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, typingSpeed);
    } else {
        bubble.innerHTML = content;
        saveChat();
    }
}

function showTyping() {
    typingIndicator.classList.remove("hidden");
}

function hideTyping() {
    typingIndicator.classList.add("hidden");
}

function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    userInput.value = "";
    showTyping();

    fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
    })
    .then(res => res.json())
    .then(data => {
        hideTyping();
        appendMessage(data.response, "vira", true);
    })
    .catch(err => {
        hideTyping();
        appendMessage("Sorry, something went wrong.", "vira");
        console.error(err);
    });
}

// Save chat + state
function saveChat() {
    localStorage.setItem("chatHistory", chatContainer.innerHTML);
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});

function selectDepartment(deptId) {
    localStorage.setItem("activeDepartment", deptId);

    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    const selectedTab = [...document.querySelectorAll(".tab")].find(btn => btn.textContent.toLowerCase().includes(deptId));
    if (selectedTab) selectedTab.classList.add("active");

    document.querySelectorAll(".subtab-group").forEach(group => group.classList.add("hidden"));
    const targetGroup = document.getElementById(`${deptId}`);
    if (targetGroup) targetGroup.classList.remove("hidden");
}

document.addEventListener("click", function (e) {
    if (e.target.classList.contains("subtab")) {
        document.querySelectorAll(".subtab").forEach(s => s.classList.remove("active"));
        e.target.classList.add("active");
        localStorage.setItem("activeSubtab", e.target.textContent.trim());
    }
});

window.addEventListener("DOMContentLoaded", () => {
    const savedDept = localStorage.getItem("activeDepartment");
    const savedSubtab = localStorage.getItem("activeSubtab");
    const savedChat = localStorage.getItem("chatHistory");

    if (savedDept) {
        selectDepartment(savedDept);
    }

    if (savedSubtab) {
        const allSubtabs = document.querySelectorAll(".subtab");
        allSubtabs.forEach(subtab => {
            if (subtab.textContent.trim() === savedSubtab) {
                subtab.classList.add("active");
            }
        });
    }

    if (savedChat) {
        chatContainer.innerHTML = savedChat;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
});

function clearMemory() {
    localStorage.clear();
    location.reload();
}

// Microphone Recording Logic
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        sendAudioToBackend(blob);
    };

    mediaRecorder.start();
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
}

function sendAudioToBackend(blob) {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");

    fetch("/transcribe", {
        method: "POST",
        body: formData,
    })
    .then(res => res.json())
    .then(data => {
        userInput.value = data.transcript;
        sendMessage();
    })
    .catch(err => {
        console.error("Audio upload failed:", err);
    });
}

micBtn.addEventListener("click", () => {
    if (!isRecording) {
        startRecording();
        micBtn.textContent = "🛑";
    } else {
        stopRecording();
        micBtn.textContent = "🎙️";
    }
    isRecording = !isRecording;
});
