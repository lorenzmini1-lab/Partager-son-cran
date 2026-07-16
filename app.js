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

// Configuration des serveurs STUN publics
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// --- VÉRIFICATION DE COMPATIBILITÉ ---
// Je vérifie si l'API est disponible dans l'environnement actuel
const isCompatible = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

if (!isCompatible) {
    statusDiv.style.color = "#ff4a5a";
    if (window.location.protocol === 'file:') {
        statusDiv.innerText = "Erreur : Tu ne peux pas tester le partage d'écran en ouvrant le fichier directement. Publie-le sur GitHub Pages ou utilise un serveur local (localhost).";
    } else {
        statusDiv.innerText = "Erreur : Ton navigateur ou ton appareil ne supporte pas le partage d'écran (exigé : ordinateur + HTTPS).";
    }
    startShareBtn.disabled = true;
}

// --- RÔLE 1 : L'ÉMETTEUR (TOI) ---
startShareBtn.onclick = async () => {
    if (!isCompatible) return;
    
    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        videoElement.srcObject = localStream;
        statusDiv.innerText = "Statut : Écran capturé. Génération de l'invitation...";

        localConnection = new RTCPeerConnection(rtcConfig);
        
        localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));

        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);

        localConnection.onicecandidate = (event) => {
            if (!event.candidate) {
                offerOut.value = btoa(JSON.stringify(localConnection.localDescription));
                statusDiv.style.color = "#06d6a0";
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
                statusDiv.innerText = "Statut : Réponse générée. Renvoie-la à ton ami.";
            }
        };
    } catch (err) {
        statusDiv.style.color = "#ff4a5a";
        statusDiv.innerText = "Erreur de décodage : " + err.message;
    }
};
