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

// Configuration des serveurs STUN publics (gratuits, fournis par Google pour trouver les adresses IP publiques)
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// --- RÔLE 1 : L'ÉMETTEUR (TOI) ---
startShareBtn.onclick = async () => {
    try {
        // Demande l'autorisation de capturer l'écran
        localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        videoElement.srcObject = localStream;
        statusDiv.innerText = "Statut : Écran capturé. Génération de l'invitation...";

        localConnection = new RTCPeerConnection(rtcConfig);
        
        // Ajoute le flux vidéo à la connexion P2P
        localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));

        // Génère l'offre WebRTC
        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);

        // On attend que tous les candidats ICE (chemins réseau) soient rassemblés pour avoir un code complet
        localConnection.onicecandidate = (event) => {
            if (!event.candidate) {
                // Quand le rassemblement est fini, on affiche le code final encodé en Base64 pour simplifier le copier-coller
                offerOut.value = btoa(JSON.stringify(localConnection.localDescription));
                statusDiv.innerText = "Statut : Invitation prête ! Envoie-la à ton ami.";
                connectBtn.disabled = false;
            }
        };
    } catch (err) {
        console.error(err);
        statusDiv.innerText = "Erreur : " + err.message;
    }
};

// Finaliser la connexion côté Émetteur
connectBtn.onclick = async () => {
    const answerRaw = answerIn.value.trim();
    if (!answerRaw) return;
    try {
        const answer = JSON.parse(atob(answerRaw));
        await localConnection.setRemoteDescription(new RTCSessionDescription(answer));
        statusDiv.innerText = "Statut : Connexion établie ! Partage en cours.";
    } catch (err) {
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

        // Quand le flux vidéo arrive, on l'affiche dans le lecteur vidéo
        remoteConnection.ontrack = (event) => {
            videoElement.srcObject = event.streams[0];
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
        statusDiv.innerText = "Erreur de décodage : " + err.message;
    }
};
