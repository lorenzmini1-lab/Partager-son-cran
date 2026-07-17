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

statusDiv.style.color = "#06d6a0";
statusDiv.innerText = "Statut : Prêt";
startShareBtn.innerText = "Partager l'écran";

// Rôle Émetteur
startShareBtn.onclick = async () => {
    statusDiv.innerText = "Demande d'autorisation de l'écran via Android...";
    
    // Si l'application tourne sur le téléphone avec notre pont natif
    if (window.AndroidScreenShare) {
        window.AndroidScreenShare.requestScreenCapturePermission();
    } else {
        statusDiv.innerText = "Mode PC/Navigateur détecté. Tentative de capture...";
        fallbackWebGetDisplayMedia();
    }
};

// Appelé automatiquement par Android quand l'utilisateur accepte la boîte de dialogue système
async function onNativeScreenShareGranted() {
    try {
        statusDiv.innerText = "Service actif. Récupération du flux vidéo...";
        
        // Utilisation propre et directe de getDisplayMedia maintenant que le service Android est démarré.
        // Cela évite l'erreur "Requested device not found".
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
            localStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });
        } else {
            throw new Error("L'API de capture d'écran n'est pas supportée par cette WebView.");
        }

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
