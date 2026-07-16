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

const hasDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
const hasUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

// Initialisation intelligente
if (!hasDisplayMedia && !hasUserMedia) {
    statusDiv.innerText = "Erreur : Non compatible.";
    startShareBtn.disabled = true;
} else {
    statusDiv.style.color = "#06d6a0";
    statusDiv.innerText = "Statut : Prêt";
    startShareBtn.innerText = hasDisplayMedia ? "Partager l'écran" : "Démarrer la caméra";
}

// Rôle Émetteur
startShareBtn.onclick = async () => {
    try {
        if (hasDisplayMedia) {
            localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } else {
            localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
        }
        videoElement.srcObject = localStream;
        localConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));
        
        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);
        localConnection.onicecandidate = (e) => {
            if (!e.candidate) {
                offerOut.value = btoa(JSON.stringify(localConnection.localDescription));
                statusDiv.innerText = "Invitation prête !";
                connectBtn.disabled = false;
            }
        };
    } catch (err) { statusDiv.innerText = "Erreur : " + err.message; }
};

// Finaliser connexion
connectBtn.onclick = async () => {
    const answer = JSON.parse(atob(answerIn.value));
    await localConnection.setRemoteDescription(new RTCSessionDescription(answer));
    statusDiv.innerText = "Connecté !";
};

// Rôle Récepteur
createAnswerBtn.onclick = async () => {
    const offer = JSON.parse(atob(offerIn.value));
    remoteConnection = new RTCPeerConnection(rtcConfig);
    remoteConnection.ontrack = (e) => videoElement.srcObject = e.streams[0];
    await remoteConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await remoteConnection.createAnswer();
    await remoteConnection.setLocalDescription(answer);
    remoteConnection.onicecandidate = (e) => {
        if (!e.candidate) answerOut.value = btoa(JSON.stringify(remoteConnection.localDescription));
    };
};