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

// Détection classique du navigateur
let hasDisplayMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

// Vérification si nous sommes sur l'application native Capacitor
const isCapacitor = !!window.Capacitor;

statusDiv.style.color = "#06d6a0";
statusDiv.innerText = "Statut : Prêt";

if (isCapacitor) {
    startShareBtn.innerText = "Partager l'écran (Mobile)";
} else {
    startShareBtn.innerText = hasDisplayMedia ? "Partager l'écran" : "Démarrer la caméra";
}

// Rôle Émetteur
startShareBtn.onclick = async () => {
    try {
        statusDiv.innerText = "Démarrage de la capture...";
        
        if (isCapacitor) {
            // Sur Android, nous devons demander la projection média native
            // Capacitor utilise une implémentation native pour récupérer le flux d'écran
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                // Sur les versions récentes, getDisplayMedia peut être simulé ou injecté par le conteneur
                try {
                    localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                } catch (e) {
                    // Fallback natif si l'API standard échoue dans la WebView
                    localStream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            mandatory: {
                                chromeMediaSource: 'screen'
                            }
                        },
                        audio: true
                    });
                }
            }
        } else {
            // Sur ordinateur / Navigateur classique
            if (hasDisplayMedia) {
                localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            } else {
                localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
            }
        }

        videoElement.srcObject = localStream;
        localConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => localConnection.addTrack(track, localStream));
        
        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);
        localConnection.onicecandidate = (e) => {
            if (!e.candidate) {
                offerOut.value = btoa(JSON.stringify(localConnection.localDescription));
                statusDiv.innerText = "Invitation prête ! Envoie-la au récepteur.";
                connectBtn.disabled = false;
            }
        };
    } catch (err) { 
        statusDiv.innerText = "Erreur de capture : " + err.message; 
        console.error(err);
    }
};

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
