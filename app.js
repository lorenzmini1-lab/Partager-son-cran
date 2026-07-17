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
startShareBtn.innerText = "Partager l'écran (Natif)";

// Émetteur : Lancer l'autorisation native
startShareBtn.onclick = () => {
    statusDiv.innerText = "Demande d'autorisation de l'écran via Android...";
    
    // On vérifie si l'application tourne dans l'environnement Android avec notre pont natif
    if (window.AndroidScreenShare) {
        window.AndroidScreenShare.startNativeScreenCapture();
    } else {
        statusDiv.innerText = "Erreur : Interface native non disponible (es-tu sur navigateur PC ?)";
        // Fallback pour le développement sur PC
        fallbackWebGetDisplayMedia();
    }
};

// Callback appelé par Android quand l'utilisateur accepte la capture d'écran
async function onNativeScreenShareGranted() {
    try {
        statusDiv.innerText = "Accès d'écran Android validé ! Initialisation du flux...";
        
        // L'astuce magique : une fois l'autorisation Android globale acquise, 
        // getUserMedia avec la contrainte vidéo d'écran est autorisée à récupérer le flux média
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                mandatory: {
                    chromeMediaSource: 'screen'
                }
            },
            audio: false
        });

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
        statusDiv.innerText = "Erreur d'initialisation du flux : " + err.message;
    }
}

// En cas de refus de la pop-up Android standard
function onNativeScreenShareDenied() {
    statusDiv.innerText = "Le partage d'écran a été refusé sur le téléphone.";
}

// Fallback sur PC
async function fallbackWebGetDisplayMedia() {
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        videoElement.srcObject = localStream;
        // Reste de l'initialisation RTC identique...
    } catch(e) {
        statusDiv.innerText = "Échec du fallback PC : " + e.message;
    }
}

// Exposer les fonctions globales pour l'interface native Android
window.onNativeScreenShareGranted = onNativeScreenShareGranted;
window.onNativeScreenShareDenied = onNativeScreenShareDenied;

// Finaliser la connexion côté Émetteur
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
