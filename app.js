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

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// --- ZONE DE DIAGNOSTIC ---
function runDiagnostic() {
    const isHttps = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const hasMediaDevices = !!navigator.mediaDevices;
    const hasGetDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

    if (!hasGetDisplayMedia) {
        statusDiv.style.color = "#ff4a5a";
        startShareBtn.disabled = true;

        let errorMsg = "Erreur de sécurité/compatibilité : ";
        if (!isHttps) {
            errorMsg += "Tu dois obligatoirement utiliser HTTPS ou localhost. Actuellement, tu es en '" + window.location.protocol + "'. Déploie le code sur GitHub Pages pour régler ça !";
        } else if (!hasMediaDevices) {
            errorMsg += "L'API de capture est totalement bloquée par ton navigateur ou ton appareil.";
        } else {
            errorMsg += "Ton navigateur ne supporte pas le partage d'écran (getDisplayMedia n'existe pas). Assure-toi d'être sur un ordinateur et pas sur un téléphone.";
        }
        statusDiv.innerText = errorMsg;
        return false;
    }
    return true;
}

const isCompatible = runDiagnostic();

// --- RÔLE 1 : L'ÉMETTEUR (TOI) ---
startShareBtn.onclick = async () => {
    if (!isCompatible) return;
    
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        videoElement.srcObject = localStream;
        statusDiv.style.color = "#06d6a0";
        statusDiv.innerText = "Statut : Écran capturé. Génération de l'invitation...";

        localConnection = new RTCPeerConnection(rtcConfig);
        
        localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));

        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);

        localConnection.onicecandidate = (event) => {
            if (!event.candidate) {
                offerOut.value = btoa(JSON.stringify(localConnection.localDescription));
                statusDiv.innerText = "Statut : Invitation prête ! Envoie-la à ton ami.";
                connectBtn.disabled = false;
            }
        };
    } catch (err) {
        console.error(err);
        statusDiv.style.color = "#ff4a5a";
        statusDiv.innerText = "Erreur : " + err.message;
    }
};

connectBtn.onclick = async () => {
    const answerRaw = answerIn.value.trim();
    if (!answerRaw) return;
    try {
        const answer = JSON.parse(atob(answerRaw));
        await localConnection.setRemoteDescription(new RTCSessionDescription(answer));
        statusDiv.style.color = "#06d6a0";
        statusDiv.innerText = "Statut : Connexion établie ! Partage en cours.";
    } catch (err) {
        statusDiv.style.color = "#ff4a5a";
        statusDiv.innerText = "Erreur lors de la connexion : " + err.message;
    }
};


// --- RÔLE 2 : LE RÉCEPTEUR (TON AMI) ---
createAnswerBtn.onclick = async () => {
    const offerRaw = offerIn.value.trim();
    if (!offerRaw) return;

    try {
        statusDiv.innerText = "Statut : Connexion à l'émetteur...";
        const offer = JSON.parse(atob(offerRaw));

        remoteConnection = new RTCPeerConnection(rtcConfig);

        remoteConnection.ontrack = (event) => {
            videoElement.srcObject = event.streams[0];
            statusDiv.style.color = "#06d6a0";
            statusDiv.innerText = "Statut : Réception du flux vidéo en direct !";
        };

        await remoteConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await remoteConnection.createAnswer();
        await remoteConnection.setLocalDescription(answer);

        remoteConnection.onicecandidate = (event) => {
            if (!event.candidate) {
                answerOut.value = btoa(JSON.stringify(remoteConnection.localDescription));
                statusDiv.style.color = "#06d6a0";
                statusDiv.innerText = "Statut : Réponse générée. Renvoie-la à ton ami.";
            }
        };
    } catch (err) {
        statusDiv.style.color = "#ff4a5a";
        statusDiv.innerText = "Erreur de décodage : " + err.message;
    }
};
