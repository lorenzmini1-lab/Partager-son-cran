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
    try {
        statusDiv.innerText = "Demande de capture d'écran...";
        
        // Si nous sommes sur Android dans Capacitor avec le plugin installé
        if (window.cordova && window.cordova.plugins && window.cordova.plugins.screenshare) {
            statusDiv.innerText = "Démarrage de la capture d'écran native...";
            window.cordova.plugins.screenshare.startShare(async (stream) => {
                localStream = stream;
                initRTCPeerConnection();
            }, (err) => {
                statusDiv.innerText = "Erreur native : " + err;
            });
        } else {
            // Sur navigateur PC ou en fallback de sécurité[span_2](start_span)[span_2](end_span)
            if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                localStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false
                });
                initRTCPeerConnection();
            } else {
                // Fallback caméra arrière si tout le reste échoue[span_3](start_span)[span_3](end_span)
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" },
                    audio: false
                });
                initRTCPeerConnection();
            }
        }
    } catch (err) { 
        statusDiv.innerText = "Erreur d'initialisation : " + err.message; 
        console.error(err);
    }
};

function initRTCPeerConnection() {
    videoElement.srcObject = localStream;
    localConnection = new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));
    
    localConnection.createOffer().then(async (offer) => {
        await localConnection.setLocalDescription(offer);
        localConnection.onicecandidate = (e) => {
            if (!e.candidate) {
                offerOut.value = btoa(JSON.stringify(localConnection.localDescription));
                statusDiv.innerText = "Invitation prête ! Transmets-la au récepteur.";
                connectBtn.disabled = false;
            }
        };
    });
}

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