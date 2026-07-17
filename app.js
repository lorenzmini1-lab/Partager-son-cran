let localConnection;
let remoteConnection;
let localStream;
let wakeLock = null;

const startShareBtn = document.getElementById('startShareBtn');
const offerOut = document.getElementById('offerOut');
const answerIn = document.getElementById('answerIn');
const connectBtn = document.getElementById('connectBtn');
const offerIn = document.getElementById('offerIn');
const createAnswerBtn = document.getElementById('createAnswerBtn');
const answerOut = document.getElementById('answerOut');
const videoElement = document.getElementById('screenVideo');
const statusDiv = document.getElementById('status');

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Canvas virtuel pour le rendu Android
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 480;
canvas.height = 854;

statusDiv.style.color = "#06d6a0";
statusDiv.innerText = "Statut : Prêt";
startShareBtn.innerText = "🚀 Démarrer le partage";

// --- INJECTION DU DESIGN PREMIUM ET PLEIN ÉCRAN ---
const style = document.createElement('style');
style.innerHTML = `
  body {
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    background: #1a1a2e !important;
    color: #e2e8f0 !important;
    padding: 20px !important;
  }
  .virtual-fullscreen {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 99999 !important;
    background-color: black !important;
    object-fit: contain !important;
  }
  .close-fullscreen-btn {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 100000;
    padding: 12px 20px;
    background: #ef476f;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(239, 71, 111, 0.4);
    cursor: pointer;
  }
  .btn-danger {
    background: linear-gradient(135deg, #ff4d6d, #ef476f) !important;
    color: white !important;
    border: none !important;
    padding: 14px 28px !important;
    border-radius: 10px !important;
    cursor: pointer !important;
    font-weight: bold !important;
    margin: 15px auto !important;
    box-shadow: 0 4px 15px rgba(239, 71, 111, 0.4);
    display: none;
    transition: transform 0.2s;
  }
  .btn-danger:active { transform: scale(0.98); }
  
  /* Animation pulsante pour le statut en cours de partage */
  .status-sharing {
    color: #06d6a0 !important;
    animation: pulse 1.5s infinite;
    font-weight: bold;
  }
  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }
`;
document.head.appendChild(style);

const closeFsBtn = document.createElement('button');
closeFsBtn.innerText = "❌ Quitter le plein écran";
closeFsBtn.className = "close-fullscreen-btn";
closeFsBtn.style.display = "none";
document.body.appendChild(closeFsBtn);

videoElement.style.cursor = "pointer";
videoElement.style.borderRadius = "12px";
videoElement.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";

const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
        videoElement.requestFullscreen?.().catch(() => applyVirtualFullscreen());
    } else {
        document.exitFullscreen?.();
    }
};

function applyVirtualFullscreen() {
    videoElement.classList.add('virtual-fullscreen');
    closeFsBtn.style.display = "block";
}

function exitVirtualFullscreen() {
    videoElement.classList.remove('virtual-fullscreen');
    closeFsBtn.style.display = "none";
}

videoElement.ondblclick = toggleFullScreen;
closeFsBtn.onclick = exitVirtualFullscreen;

document.onfullscreenchange = () => {
    if (!document.fullscreenElement) exitVirtualFullscreen();
};

// Injection dynamique du bouton rouge d'arrêt s'il n'existe pas
let stopShareBtn = document.getElementById('stopShareBtn');
if (!stopShareBtn) {
    stopShareBtn = document.createElement('button');
    stopShareBtn.id = "stopShareBtn";
    stopShareBtn.className = "btn-danger";
    stopShareBtn.innerText = "🛑 Arrêter le partage";
    startShareBtn.parentNode.insertBefore(stopShareBtn, startShareBtn.nextSibling);
}
stopShareBtn.onclick = () => stopAllSharing();

// Maintien d'éveil matériel (Wake Lock)
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.warn("WakeLock non activé:", err.message);
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => { wakeLock = null; });
    }
}

// Rôle Émetteur
startShareBtn.onclick = async () => {
    statusDiv.innerText = "Demande d'autorisation de l'écran...";
    if (window.AndroidScreenShare) {
        window.AndroidScreenShare.requestScreenCapturePermission();
    } else {
        fallbackWebGetDisplayMedia();
    }
};

window.onNativeFrame = function(base64Image) {
    const img = new Image();
    img.onload = function() {
        if (canvas.width !== img.width || canvas.height !== img.height) {
            canvas.width = img.width;
            canvas.height = img.height;
        }
        ctx.drawImage(img, 0, 0);
    };
    img.src = "data:image/jpeg;base64," + base64Image;
};

async function onNativeScreenShareGranted() {
    try {
        statusDiv.className = "status-sharing";
        statusDiv.innerText = "🔴 Partage en cours (Arrière-plan actif)";
        startShareBtn.style.display = "none";
        stopShareBtn.style.display = "block";
        
        await requestWakeLock();
        localStream = canvas.captureStream(8); 
        videoElement.srcObject = localStream;
        
        localConnection = new RTCPeerConnection(rtcConfig);
        
        // --- AMÉLIORATION : GESTION DE LA RECONNEXION AUTOMATIQUE ---
        localConnection.oniceconnectionstatechange = () => {
            if (localConnection.iceConnectionState === "disconnected" || localConnection.iceConnectionState === "failed") {
                statusDiv.innerText = "🔄 Reconnexion en cours...";
                // Tente une relance automatique silencieuse des canaux ICE
                localConnection.restartIce?.();
            } else if (localConnection.iceConnectionState === "connected") {
                statusDiv.innerText = "🔴 Partage en cours (Arrière-plan actif)";
            }
        };

        localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));
        
        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);
        localConnection.onicecandidate = (e) => {
            if (!e.candidate) {
                offerOut.value = btoa(JSON.stringify(localConnection.localDescription));
                connectBtn.disabled = false;
            }
        };
    } catch (err) {
        statusDiv.className = "";
        statusDiv.innerText = "Erreur : " + err.message;
    }
}

function stopAllSharing() {
    statusDiv.className = "";
    statusDiv.innerText = "Statut : Partage arrêté.";
    startShareBtn.style.style.display = "block";
    stopShareBtn.style.display = "none";
    
    releaseWakeLock();
    if (localStream) { localStream.getTracks().forEach(track => track.stop()); localStream = null; }
    if (localConnection) { localConnection.close(); localConnection = null; }
    if (videoElement) videoElement.srcObject = null;
    
    if (window.AndroidScreenShare) {
        window.AndroidScreenShare.stopScreenCapture();
    }
}

// Reçoit l'action d'arrêt directement depuis le clic sur la notification Android
window.onNativeStopCommand = function() {
    stopAllSharing();
};

function onNativeScreenShareDenied() {
    statusDiv.innerText = "Le partage d'écran a été refusé.";
    stopAllSharing();
}

async function fallbackWebGetDisplayMedia() {
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        videoElement.srcObject = localStream;
        localConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));
        startShareBtn.style.display = "none";
        stopShareBtn.style.display = "block";
        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);
        localConnection.onicecandidate = (e) => {
            if (!e.candidate) {
                offerOut.value = btoa(JSON.stringify(localConnection.localDescription));
                connectBtn.disabled = false;
            }
        };
    } catch(e) {
        statusDiv.innerText = "Échec : " + e.message;
    }
}

window.onNativeScreenShareGranted = onNativeScreenShareGranted;
window.onNativeScreenShareDenied = onNativeScreenShareDenied;

connectBtn.onclick = async () => {
    try {
        const answer = JSON.parse(atob(answerIn.value));
        await localConnection.setRemoteDescription(new RTCSessionDescription(answer));
        statusDiv.innerText = "✅ Connecté avec succès !";
    } catch (err) {
        statusDiv.innerText = "Erreur : " + err.message;
    }
};

// Rôle Récepteur
createAnswerBtn.onclick = async () => {
    try {
        const offer = JSON.parse(atob(offerIn.value));
        remoteConnection = new RTCPeerConnection(rtcConfig);
        remoteConnection.ontrack = (e) => videoElement.srcObject = e.streams[0];
        await remoteConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await remoteConnection.createAnswer();
        await remoteConnection.setLocalDescription(answer);
        remoteConnection.onicecandidate = (e) => {
            if (!e.candidate) {
                answerOut.value = btoa(JSON.stringify(remoteConnection.localDescription));
            }
        };
    } catch (err) {
        statusDiv.innerText = "Erreur Récepteur : " + err.message;
    }
};
