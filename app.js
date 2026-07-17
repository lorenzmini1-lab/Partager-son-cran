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

// --- AJOUT : OPTION D'AGRANDISSEMENT ---
// Ajoute des styles de base à l'élément vidéo pour qu'il soit cliquable et réactif
videoElement.style.cursor = "pointer";
videoElement.style.transition = "transform 0.3s ease";
videoElement.title = "Double-clique pour passer en plein écran";

// Fonction pour basculer en plein écran
const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
        if (videoElement.requestFullscreen) {
            videoElement.requestFullscreen();
        } else if (videoElement.webkitRequestFullscreen) { /* Safari / iOS */
            videoElement.webkitRequestFullscreen();
        } else if (videoElement.msRequestFullscreen) { /* IE11 */
            videoElement.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
};

// Double-cliquer sur la vidéo pour l'agrandir en plein écran
videoElement.ondblclick = toggleFullScreen;

// Ajouter également un bouton d'agrandissement sous la vidéo s'il n'existe pas déjà
let zoomBtn = document.getElementById('zoomBtn');
if (!zoomBtn) {
    zoomBtn = document.createElement('button');
    zoomBtn.id = 'zoomBtn';
    zoomBtn.innerText = "📺 Plein écran";
    zoomBtn.style.margin = "10px auto";
    zoomBtn.style.display = "block";
    zoomBtn.style.padding = "8px 16px";
    zoomBtn.style.backgroundColor = "#118ab2";
    zoomBtn.style.color = "white";
    zoomBtn.style.border = "none";
    zoomBtn.style.borderRadius = "5px";
    zoomBtn.style.cursor = "pointer";
    zoomBtn.onclick = toggleFullScreen;
    // Insérer le bouton juste après la vidéo
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
