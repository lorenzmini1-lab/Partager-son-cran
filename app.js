let localConnection;
let remoteConnection;
let localStream;

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

// Création d'un Canvas virtuel pour le rendu de la capture d'écran Android
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 480;
canvas.height = 854; // Standard format mobile

statusDiv.style.color = "#06d6a0";
statusDiv.innerText = "Statut : Prêt";
startShareBtn.innerText = "Partager l'écran";

// --- AJOUT : STYLE POUR LE PLEIN ÉCRAN VIRTUEL ---
// On injecte un petit style CSS pour notre mode "Plein écran alternatif" (infaillible sur WebView)
const style = document.createElement('style');
style.innerHTML = `
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
    padding: 10px 15px;
    background: rgba(255, 0, 0, 0.8);
    color: white;
    border: none;
    border-radius: 5px;
    font-weight: bold;
    cursor: pointer;
  }
`;
document.head.appendChild(style);

// Création d'un bouton pour quitter le plein écran virtuel
const closeFsBtn = document.createElement('button');
closeFsBtn.innerText = "Quitter le plein écran";
closeFsBtn.className = "close-fullscreen-btn";
closeFsBtn.style.display = "none";
document.body.appendChild(closeFsBtn);

videoElement.style.cursor = "pointer";
videoElement.title = "Double-clique pour agrandir";

// Fonction hybride : Plein écran natif OU virtuel si le natif est bloqué
const toggleFullScreen = () => {
    // 1. On tente d'abord la méthode classique (si le navigateur/WebView l'autorise)
    if (!document.fullscreenElement) {
        videoElement.requestFullscreen?.()
            .catch(() => {
                // 2. Si le plein écran natif échoue ou est bloqué par la WebView, on applique le plan B (Plein écran virtuel)
                applyVirtualFullscreen();
            });
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

// Actions pour quitter/entrer
videoElement.ondblclick = toggleFullScreen;
closeFsBtn.onclick = exitVirtualFullscreen;

// Gestionnaire d'échappement pour le plein écran natif standard
document.onfullscreenchange = () => {
    if (!document.fullscreenElement) {
        exitVirtualFullscreen();
    }
};

// Ajouter également un bouton d'agrandissement sous la vidéo s'il n'existe pas déjà
let zoomBtn = document.getElementById('zoomBtn');
if (!zoomBtn) {
    zoomBtn = document.createElement('button');
    zoomBtn.id = 'zoomBtn';
    zoomBtn.innerText = "📺 Agrandir / Plein écran";
    zoomBtn.style.margin = "10px auto";
    zoomBtn.style.display = "block";
    zoomBtn.style.padding = "8px 16px";
    zoomBtn.style.backgroundColor = "#118ab2";
    zoomBtn.style.color = "white";
    zoomBtn.style.border = "none";
    zoomBtn.style.borderRadius = "5px";
    zoomBtn.style.cursor = "pointer";
    zoomBtn.onclick = () => {
        // Force directement le plein écran virtuel qui fonctionne partout, même sans permission
        if (videoElement.classList.contains('virtual-fullscreen')) {
            exitVirtualFullscreen();
        } else {
            applyVirtualFullscreen();
        }
    };
    videoElement.parentNode.insertBefore(zoomBtn, videoElement.nextSibling);
}
// ----------------------------------------

// Rôle Émetteur
startShareBtn.onclick = async () => {
    statusDiv.innerText = "Demande d'autorisation de l'écran via Android...";
    
    // Si l'application tourne sur le téléphone avec notre pont natif
    if (window.AndroidScreenShare) {
        window.AndroidScreenShare.requestScreenCapturePermission();
    } else {
        statusDiv.innerText = "Mode PC détecté. Tentative de capture standard...";
        fallbackWebGetDisplayMedia();
    }
};

// Réception des frames de l'écran natif envoyées par Java
window.onNativeFrame = function(base64Image) {
    const img = new Image();
    img.onload = function() {
        // Redimensionner le canvas si la taille de l'image change
        if (canvas.width !== img.width || canvas.height !== img.height) {
            canvas.width = img.width;
            canvas.height = img.height;
        }
        ctx.drawImage(img, 0, 0);
    };
    img.src = "data:image/jpeg;base64," + base64Image;
};

// Appelé automatiquement par Android quand l'utilisateur accepte le partage d'écran
async function onNativeScreenShareGranted() {
    try {
        statusDiv.innerText = "Capture active. Génération du flux vidéo...";
        
        // On capture le flux vidéo directement depuis le canvas de dessin à 8 FPS !
        localStream = canvas.captureStream(8); 

        videoElement.srcObject = localStream;
        localConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));
        
        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);
        localConnection.onicecandidate = (e) => {
            if (!e.candidate) {
                offerOut.value = btoa(JSON.stringify(localConnection.localDescription));
                statusDiv.innerText = "Invitation prête ! Transmets-la au récepteur.";
                connectBtn.disabled = false;
            }
        };
    } catch (err) {
        statusDiv.innerText = "Erreur de flux : " + err.message;
        console.error(err);
    }
}

// Appelé si l'utilisateur refuse la pop-up système Android
function onNativeScreenShareDenied() {
    statusDiv.innerText = "Le partage d'écran a été refusé sur le téléphone.";
}

// Fallback pour le développement sur ordinateur
async function fallbackWebGetDisplayMedia() {
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        videoElement.srcObject = localStream;
        localConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));
        
        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);
        localConnection.onicecandidate = (e) => {
            if (!e.candidate) {
                offerOut.value = btoa(JSON.stringify(localConnection.localDescription));
                statusDiv.innerText = "Invitation prête ! (PC)";
                connectBtn.disabled = false;
            }
        };
    } catch(e) {
        statusDiv.innerText = "Échec de la capture PC : " + e.message;
    }
}

// Exposer les fonctions de callback pour le code Java natif d'Android
window.onNativeScreenShareGranted = onNativeScreenShareGranted;
window.onNativeScreenShareDenied = onNativeScreenShareDenied;

// Finaliser connexion
connectBtn.onclick = async () => {
    try {
        const answer = JSON.parse(atob(answerIn.value));
        await localConnection.setRemoteDescription(new RTCSessionDescription(answer));
        statusDiv.innerText = "Connecté ! Partage en cours.";
    } catch (err) {
        statusDiv.innerText = "Erreur finalisation : " + err.message;
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
                statusDiv.innerText = "Réponse générée ! Copie-la vers l'émetteur.";
            }
        };
    } catch (err) {
        statusDiv.innerText = "Erreur Récepteur : " + err.message;
    }
};
