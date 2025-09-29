// Gestor de recursos multimedia
const MediaManager = (() => {
    let currentActiveAudio = null;
    let currentActiveWebP = null;
    
    function pauseAllAudio(exceptAudio = null) {
        document.querySelectorAll('audio:not(#backgroundMusic)').forEach(audio => {
            if (audio !== exceptAudio && !audio.paused) {
                audio.pause();
            }
        });
    }
    
    function hideAllWebP(exceptWebP = null) {
        document.querySelectorAll('.avatar-image:not(#avatarImageSleep)').forEach(webp => {
            if (webp !== exceptWebP) webp.style.display = 'none';
        });
        document.querySelectorAll('.overlay-webp').forEach(webp => {
            if (webp !== exceptWebP && webp.parentElement.classList.contains('visible')) {
                webp.parentElement.classList.remove('visible');
                webp.src = '';
            }
        });
    }
    
    function playAudio(audioElement, webpElement, audioSrc = null, webpSrc = null) {
        if (!audioElement) return;
        
        if (window.stopContentAudio) {
            window.stopContentAudio();
        }

        pauseAllAudio(audioElement);
        if (webpElement) hideAllWebP(webpElement);
        
        if (audioSrc && audioElement.src !== audioSrc) audioElement.src = audioSrc;
        if (webpSrc && webpElement) webpElement.src = webpSrc;
        
        if (webpElement) {
            if (webpElement.classList.contains('avatar-image')) {
                webpElement.style.display = 'block';
            } else {
                webpElement.parentElement.classList.add('visible');
            }
        }
        
        const playPromise = audioElement.play();
        if (playPromise) {
            playPromise.catch(e => {
                console.error("Error al reproducir audio:", e);
                if (e.name === 'NotAllowedError') AudioPlayer.showMicroAlert("❌ Permiso denegado para reproducir audio");
            });
        }
        
        currentActiveAudio = audioElement;
        currentActiveWebP = webpElement;
    }
    
    return { pauseAllAudio, hideAllWebP, playAudio };
})();

// Reproductor principal
const AudioPlayer = (() => {
    const elements = {
        audioPlayer: document.querySelector('.audio-player'),
        expandButton: document.querySelector('.expand-button'),
        playButtonMain: document.querySelector('.play-button-main'),
        progressFill: document.querySelector('.progress-fill'),
        timeDisplay: document.querySelector('.time-display'),
        backgroundMusic: document.getElementById('backgroundMusic'),
        prevButton: document.querySelector('.prev'),
        nextButton: document.querySelector('.next'),
        musicButton: document.querySelector('.music-button'),
        progressBar: document.querySelector('.progress-bar'),
        narratorControl: document.querySelector('.narrator-control'),
        narratorsButton: document.querySelector('.narrators-button'),
        narratorOptions: document.querySelectorAll('.narrator-option'),
        playerClosed: document.querySelector('.player-closed'),
        avatarImageSleep: document.getElementById('avatarImageSleep'),
        avatarImageSpeak: document.getElementById('avatarImageSpeak'),
        microAlert: document.getElementById('microAlert'),
        showAvatarArea: document.getElementById('showAvatarArea'),
        infoButton: document.querySelector('.info-button'),
        infoPanel: document.querySelector('.info-panel')
    };

    const narratorData = {
        1: { name: 'Nara', sleep: 'webp/nara-espera.webp', hasVoice: true, speakingWebp: 'webp/nara-speak02.webp', audioSequence: ['audio/nara-speak01.mp3', 'audio/nara-speak02.mp3'], tutorialAudio: 'audio/tutorial-nara.mp3', tutorialWebp: 'webp/nara-tutorial.webp' },
        2: { name: 'Mimi', sleep: 'webp/mimi-espera.webp', hasVoice: true, speakingWebp: 'webp/mimi-intro.webp', audioSequence: ['audio/mimi-speak01.mp3', 'audio/mimi-speak02.mp3', 'audio/mimi-speak03.mp3'], tutorialAudio: 'audio/tutorial-mimi.mp3', tutorialWebp: 'webp/mimi-tutorial.webp' },
        3: { name: 'Vid', sleep: 'webp/vid-espera.webp', hasVoice: false, speakingWebp: '', audioSequence: [], tutorialAudio: '', tutorialWebp: '' },
        4: { name: 'Ava', sleep: 'webp/ava-espera.webp', hasVoice: false, speakingWebp: '', audioSequence: [], tutorialAudio: '', tutorialWebp: '' }
    };

    const state = { 
        isExpanded: false, isNarratorPlaying: false, isMusicPlaying: false, currentNarratorId: 1, currentAudioIndex: 0, isDragging: false, 
        isHiddenByContainer: false, avatarAudio: new Audio(), tutorialAudio: new Audio(), isHidden: false, tutorialPlayed: 0, isPlayingTutorial: false,
        interactionCount: 0, tutorialTriggered: false
    };

    function checkTutorialStatus() {
        const tutorialCount = localStorage.getItem('tutorialPlayed') || 0;
        state.tutorialPlayed = parseInt(tutorialCount);
        setupInteractionTracking();
    }

    function setupInteractionTracking() {
        const interactionEvents = ['click', 'touchstart', 'keydown', 'scroll'];
        const handler = () => {
            state.interactionCount++;
            if (state.interactionCount >= 2 && !state.tutorialTriggered && state.tutorialPlayed < 2) {
                state.tutorialTriggered = true;
                playTutorialAuto();
                interactionEvents.forEach(evt => document.removeEventListener(evt, handler));
            }
        };
        interactionEvents.forEach(eventType => document.addEventListener(eventType, handler, { once: state.tutorialTriggered }));
    }

    function playTutorialAuto() {
        const narrator = narratorData[state.currentNarratorId];
        if (!narrator.tutorialAudio) return;
        checkAudioAvailability(narrator.tutorialAudio, (isAvailable) => {
            if (isAvailable) {
                setTimeout(() => showMicroAlert("🎧 Tutorial de funcionalidades disponible", "info"), 1000);
            }
        });
    }

    function checkAudioAvailability(audioUrl, callback) {
        if (!audioUrl) { callback(false); return; }
        const xhr = new XMLHttpRequest();
        xhr.open('HEAD', audioUrl, true);
        xhr.onreadystatechange = () => { if (xhr.readyState === 4) callback(xhr.status === 200); };
        xhr.onerror = () => callback(false);
        xhr.send();
    }

    function playTutorialManual() {
        const narrator = narratorData[state.currentNarratorId];
        if (!narrator.tutorialAudio) {
            showMicroAlert("ℹ️ Esta página no tiene explicación de funcionalidades", "info");
            return;
        }
        checkAudioAvailability(narrator.tutorialAudio, (isAvailable) => {
            if (!isAvailable) {
                showMicroAlert("❌ El audio explicativo no está disponible", "warning");
                return;
            }
            if (state.isPlayingTutorial) {
                state.tutorialAudio.pause();
                state.isPlayingTutorial = false;
                updateAvatarOnStop();
                return;
            }
            MediaManager.pauseAllAudio();
            if (window.ContentContainers) ContentContainers.stopAll();
            state.isPlayingTutorial = true;
            elements.avatarImageSleep.classList.remove('active');
            MediaManager.playAudio(state.tutorialAudio, elements.avatarImageSpeak, narrator.tutorialAudio, narrator.tutorialWebp);
            state.tutorialAudio.addEventListener('ended', () => {
                state.isPlayingTutorial = false;
                updateAvatarOnStop();
                state.tutorialPlayed++;
                localStorage.setItem('tutorialPlayed', state.tutorialPlayed);
            }, { once: true });
            state.tutorialAudio.addEventListener('error', () => {
                state.isPlayingTutorial = false;
                updateAvatarOnStop();
                showMicroAlert("❌ Error al reproducir el tutorial", "warning");
            }, { once: true });
        });
    }

    function init() {
        state.avatarAudio.preload = 'auto';
        state.tutorialAudio.preload = 'auto';
        setupEventListeners();
        changeNarrator(state.currentNarratorId, false);
        positionPlayerTopRight();
        checkTutorialStatus();
        
        elements.playerClosed.addEventListener('dblclick', toggleAvatarVisibility);
        elements.showAvatarArea.addEventListener('dblclick', toggleAvatarVisibility);
        
        elements.playerClosed.addEventListener('click', (e) => {
            if (state.isDragging || AudioPlayer.state.isExpanded) return;
            playTutorialManual();
        });

        elements.infoButton.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.infoPanel.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!elements.infoPanel.contains(e.target) && !elements.infoButton.contains(e.target)) {
                elements.infoPanel.classList.remove('show');
            }
        });
    }

    function positionPlayerTopRight() {
        elements.audioPlayer.style.cssText = 'right: 20px; top: 20px; left: auto; bottom: auto;';
        elements.showAvatarArea.style.cssText = 'right: 20px; top: 20px; left: auto; bottom: auto;';
    }

    function setupEventListeners() {
        elements.playButtonMain.addEventListener('click', toggleNarratorPlayback);
        elements.prevButton.addEventListener('click', () => navigateSequence('prev'));
        elements.nextButton.addEventListener('click', () => navigateSequence('next'));
        // Se elimina el mousedown de aquí para que lo controle solo el módulo de arrastre
        // elements.playerClosed.addEventListener('mousedown', () => state.isDragging = false);
        state.avatarAudio.addEventListener('ended', handleAudioEnded);
        state.avatarAudio.addEventListener('timeupdate', updateProgress);
        
        elements.narratorOptions.forEach(option => {
            option.addEventListener('click', function() {
                const newNarratorId = parseInt(this.dataset.narrator, 10);
                if (newNarratorId !== state.currentNarratorId) {
                    changeNarrator(newNarratorId);
                    if (state.isExpanded) {
                        toggleExpand();
                    }
                }
                elements.narratorControl.classList.remove('is-open');
            });
        });

        elements.musicButton.addEventListener('click', toggleBackgroundMusic);
        elements.progressBar.addEventListener('click', seekAudio);
        elements.expandButton.addEventListener('click', toggleExpand);
        elements.narratorsButton.addEventListener('click', toggleNarratorSelector);
        document.addEventListener('click', e => {
            if (state.isExpanded && !elements.audioPlayer.contains(e.target) && !elements.expandButton.contains(e.target)) toggleExpand();
            if (elements.narratorControl.classList.contains('is-open') && !e.target.closest('.narrator-control')) elements.narratorControl.classList.remove('is-open');
        });
    }

    function toggleAvatarVisibility() {
        state.isHidden = !state.isHidden;
        if (state.isHidden) {
            elements.audioPlayer.classList.add('hidden');
            elements.showAvatarArea.classList.add('visible');
            if (state.isNarratorPlaying) stopPlayback();
            if (state.isPlayingTutorial) {
                state.tutorialAudio.pause();
                state.isPlayingTutorial = false;
            }
        } else {
            elements.audioPlayer.classList.remove('hidden');
            elements.showAvatarArea.classList.remove('visible');
        }
        localStorage.setItem('avatarHidden', state.isHidden);
    }

    function checkAvatarVisibility() {
        if (localStorage.getItem('avatarHidden') === 'true') {
            state.isHidden = true;
            elements.audioPlayer.classList.add('hidden');
            elements.showAvatarArea.classList.add('visible');
        }
    }

    function updateAvatarOnStop() {
        elements.avatarImageSpeak.style.display = 'none';
        elements.avatarImageSleep.classList.add('active');
    }

    function playCurrentAudio() {
        if (state.isHidden) return;
        if (window.ContentContainers) ContentContainers.stopAll();
        const narrator = narratorData[state.currentNarratorId];
        if (!narrator.hasVoice || narrator.audioSequence.length === 0) {
            stopPlayback(); return;
        }
        state.currentAudioIndex = Math.max(0, Math.min(state.currentAudioIndex, narrator.audioSequence.length - 1));
        elements.avatarImageSleep.classList.remove('active');
        const audioSrc = narrator.audioSequence[state.currentAudioIndex];
        const webpSrc = narrator.speakingWebp;
        MediaManager.playAudio(state.avatarAudio, elements.avatarImageSpeak, audioSrc, webpSrc);
        state.isNarratorPlaying = true;
        updatePlayButtons();
    }

    function stopPlayback() {
        state.isNarratorPlaying = false;
        state.avatarAudio.pause();
        state.avatarAudio.currentTime = 0;
        updateAvatarOnStop();
        updatePlayButtons();
        elements.progressFill.style.width = '0%';
        elements.timeDisplay.textContent = '0:00';
    }

    function toggleNarratorPlayback() {
        if (state.isHidden || !narratorData[state.currentNarratorId].hasVoice) return;
        if (state.isPlayingTutorial) {
            state.tutorialAudio.pause();
            state.isPlayingTutorial = false;
            updateAvatarOnStop();
            return;
        }
        if (window.ContentContainers) ContentContainers.stopAll();
        if (state.isNarratorPlaying) {
            state.avatarAudio.pause();
            state.isNarratorPlaying = false;
            updateAvatarOnStop();
        } else {
            playCurrentAudio();
        }
        updatePlayButtons();
    }

    function navigateSequence(direction) {
        const { audioSequence, hasVoice } = narratorData[state.currentNarratorId];
        if (!hasVoice) return;
        const lastIndex = audioSequence.length - 1;
        if (direction === 'next') state.currentAudioIndex = Math.min(state.currentAudioIndex + 1, lastIndex);
        else if (direction === 'prev') state.currentAudioIndex = Math.max(state.currentAudioIndex - 1, 0);
        if (state.isNarratorPlaying) playCurrentAudio();
    }

    function changeNarrator(narratorId, startPlaying = false) {
        MediaManager.pauseAllAudio();
        MediaManager.hideAllWebP();
        state.currentNarratorId = narratorId;
        state.currentAudioIndex = 0;
        state.isPlayingTutorial = false;
        elements.narratorOptions.forEach(opt => opt.classList.toggle('active', parseInt(opt.dataset.narrator) === narratorId));
        const narrator = narratorData[narratorId];
        if (narrator) {
            elements.avatarImageSleep.src = narrator.sleep;
            elements.avatarImageSleep.onload = () => elements.avatarImageSleep.classList.add('active');
            stopPlayback();
        }
        if (startPlaying) playCurrentAudio();
    }

    function handleAudioEnded() { stopPlayback(); }

    function updateProgress() {
        const { currentTime, duration } = state.avatarAudio;
        if (duration > 0) {
            elements.progressFill.style.width = `${(currentTime / duration) * 100}%`;
            const mins = Math.floor(currentTime / 60);
            const secs = Math.floor(currentTime % 60).toString().padStart(2, '0');
            elements.timeDisplay.textContent = `${mins}:${secs}`;
        }
    }

    function seekAudio(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        if (state.avatarAudio.duration) state.avatarAudio.currentTime = percent * state.avatarAudio.duration;
    }

    function toggleBackgroundMusic() {
        state.isMusicPlaying = !state.isMusicPlaying;
        if (state.isMusicPlaying) elements.backgroundMusic.play().catch(e => console.error("Error al reproducir música:", e));
        else elements.backgroundMusic.pause();
        elements.musicButton.classList.toggle('active', state.isMusicPlaying);
    }

    function toggleNarratorSelector() {
        const rect = elements.audioPlayer.getBoundingClientRect();
        const openUpward = rect.bottom > window.innerHeight * 0.6;
        elements.narratorControl.classList.toggle('open-upward', openUpward);
        elements.narratorControl.classList.toggle('is-open');
    }

    function toggleExpand(e) {
        if (e) e.stopPropagation();
        state.isExpanded = !state.isExpanded;
        elements.audioPlayer.classList.toggle('expanded', state.isExpanded);
        elements.playerClosed.style.display = state.isExpanded ? 'none' : '';
    }

    function updatePlayButtons() {
        elements.playButtonMain.classList.toggle('playing', state.isNarratorPlaying || state.isPlayingTutorial);
    }

    function showMicroAlert(message = "Toca de nuevo para escuchar", type = "info") {
        elements.microAlert.textContent = message;
        elements.microAlert.className = 'micro-alert';
        elements.microAlert.classList.add('show', type);
        setTimeout(() => elements.microAlert.classList.remove('show'), 3000);
    }
    
    const togglePlayerVisibility = (show) => {
        elements.audioPlayer.style.opacity = show ? '1' : '0';
        elements.audioPlayer.style.pointerEvents = show ? 'auto' : 'none';
        state.isHiddenByContainer = !show;
    };

    init();
    checkAvatarVisibility();

    return {
        getCurrentNarrator: () => narratorData[state.currentNarratorId],
        stop: stopPlayback,
        hideAvatar: () => togglePlayerVisibility(false),
        showAvatar: () => togglePlayerVisibility(true),
        showMicroAlert,
        state,
        toggleExpand 
    };
})();

// Gestor de contenedores
const ContentContainers = (() => {
    const containers = document.querySelectorAll('.content-container');
    let activeContainer = null;
    let activeMode = null;
    let clickTimer = null;
    let clickCount = 0;
    
    const simpleAudioFiles = { 1: 'audio/audio1.mp3', 2: 'audio/audio2.mp3', 3: 'audio/audio3.mp3', 4: 'audio/audio4.mp3' };

    function init() {
        containers.forEach(container => {
            container.simpleAudio = new Audio();
            container.avatarAudio = new Audio();
            container.simpleAudio.preload = 'auto';
            container.avatarAudio.preload = 'auto';

            container.addEventListener('click', function(e) {
                if (e.target.closest('.webp-overlay-container.visible')) {
                    stopContainer(container); return;
                }
                clickCount++;
                if (clickCount === 1) {
                    clickTimer = setTimeout(() => { handleSingleClick(container); clickCount = 0; }, 250);
                } else if (clickCount === 2) {
                    clearTimeout(clickTimer);
                    handleDoubleClick(container);
                    clickCount = 0;
                }
            });

            container.simpleAudio.addEventListener('ended', () => stopContainer(container));
            container.avatarAudio.addEventListener('ended', () => stopContainer(container));
        });
    }

    function handleSingleClick(container) {
        if (activeContainer === container) {
            stopContainer(container);
            return;
        }

        const audioId = parseInt(container.dataset.audioId);
        const audioFile = simpleAudioFiles[audioId];
        if (!audioFile) return;

        if (activeContainer) stopContainer(activeContainer);
        AudioPlayer.stop();
        
        container.simpleAudio.src = audioFile;
        MediaManager.playAudio(container.simpleAudio, null);
        
        container.classList.add('playing-simple');
        container.classList.remove('playing-avatar');
        activeContainer = container;
        activeMode = 'simple';
    }

    function handleDoubleClick(container) {
        if (activeContainer === container && activeMode === 'avatar') {
            stopContainer(container);
            return;
        }

        const audioId = parseInt(container.dataset.audioId);
        const narrator = AudioPlayer.getCurrentNarrator();
        if (!narrator.hasVoice) {
            AudioPlayer.showMicroAlert("❌ Este avatar no tiene narración disponible");
            return;
        }
        
        if (activeContainer) stopContainer(activeContainer);
        AudioPlayer.stop();
        AudioPlayer.hideAvatar();
        
        const audioIndex = audioId - 1;
        if (!narrator.audioSequence || !narrator.audioSequence[audioIndex]) {
            AudioPlayer.showAvatar();
            AudioPlayer.showMicroAlert("❌ Audio no disponible para este avatar");
            return;
        }
        
        const audioSrc = narrator.audioSequence[audioIndex];
        const webpSrc = narrator.speakingWebp;
        const webpOverlay = container.querySelector('.overlay-webp');
        
        container.avatarAudio.src = audioSrc;
        MediaManager.playAudio(container.avatarAudio, webpOverlay, audioSrc, webpSrc);
        
        container.classList.add('playing-avatar');
        container.classList.remove('playing-simple');
        activeContainer = container;
        activeMode = 'avatar';
    }

    function stopContainer(container) {
        if (!container) return;
        
        container.simpleAudio.pause();
        container.simpleAudio.currentTime = 0;
        container.avatarAudio.pause();
        container.avatarAudio.currentTime = 0;
        
        const overlayContainer = container.querySelector('.webp-overlay-container');
        if (overlayContainer) {
            overlayContainer.classList.remove('visible');
            const overlay = container.querySelector('.overlay-webp');
            if (overlay) overlay.src = '';
        }
        
        container.classList.remove('playing-simple', 'playing-avatar');
        
        AudioPlayer.showAvatar();
        
        if (activeContainer === container) {
            activeContainer = null;
            activeMode = null;
        }
    }

    init();

    return { stopAll: () => stopContainer(activeContainer) };
})();

window.stopContentAudio = () => {
    if (ContentContainers) ContentContainers.stopAll();
};

// ✅ MEJORADO: Módulo para arrastrar el avatar con lógica optimizada
(function() {
    const player = document.querySelector('.audio-player');
    const showAvatarArea = document.querySelector('.showAvatarArea');
    
    let isMouseDown = false;
    let hasDragged = false;
    let startX, startY, initialLeft, initialTop;
    let dragTarget = null;
    
    const DRAG_THRESHOLD = 8; // Umbral ligeramente mayor para evitar arrastres accidentales
    const RESET_DELAY = 100; // Delay más conservador para el reset del estado

    const getEventCoords = (e) => ({
        x: e.clientX || e.touches[0]?.clientX || 0,
        y: e.clientY || e.touches[0]?.clientY || 0
    });

    const isValidDragTarget = (target) => {
        return target.closest('.player-closed') || target.closest('.show-avatar-area');
    };

    const getPlayerElement = (target) => {
        if (target.closest('.player-closed')) return player;
        if (target.closest('.show-avatar-area')) return showAvatarArea;
        return null;
    };

    const startDrag = (e) => {
        // Verificar si es un objetivo válido para arrastrar
        if (!isValidDragTarget(e.target) || AudioPlayer.state.isExpanded) return;
        
        dragTarget = getPlayerElement(e.target);
        if (!dragTarget) return;

        isMouseDown = true;
        hasDragged = false;
        
        const rect = dragTarget.getBoundingClientRect();
        const coords = getEventCoords(e);
        
        initialLeft = rect.left;
        initialTop = rect.top;
        startX = coords.x;
        startY = coords.y;
        
        // Agregar clase preparatoria sin interferir con el comportamiento
        dragTarget.style.userSelect = 'none';
    };

    const duringDrag = (e) => {
        if (!isMouseDown || !dragTarget) return;

        const coords = getEventCoords(e);
        const deltaX = Math.abs(coords.x - startX);
        const deltaY = Math.abs(coords.y - startY);

        // Determinar si supera el umbral de arrastre
        if (!hasDragged && (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD)) {
            hasDragged = true;
            AudioPlayer.state.isDragging = true;
            dragTarget.classList.add('dragging');
        }

        // Solo procesar movimiento si ya se confirmó como arrastre
        if (hasDragged) {
            e.preventDefault();
            
            let newX = initialLeft + (coords.x - startX);
            let newY = initialTop + (coords.y - startY);
            
            // Aplicar límites con margen dinámico basado en el tamaño del elemento
            const margin = 15;
            const maxX = window.innerWidth - dragTarget.offsetWidth - margin;
            const maxY = window.innerHeight - dragTarget.offsetHeight - margin;
            
            newX = Math.max(margin, Math.min(newX, maxX));
            newY = Math.max(margin, Math.min(newY, maxY));
            
            // Aplicar nueva posición
            dragTarget.style.left = `${newX}px`;
            dragTarget.style.top = `${newY}px`;
            dragTarget.style.right = 'auto';
            dragTarget.style.bottom = 'auto';
        }
    };
    
    const stopDrag = () => {
        if (!dragTarget) return;
        
        isMouseDown = false;
        dragTarget.classList.remove('dragging');
        dragTarget.style.userSelect = '';
        
        // Reset con delay apropiado para evitar interferencias con eventos click
        if (hasDragged) {
            setTimeout(() => {
                AudioPlayer.state.isDragging = false;
                hasDragged = false;
                dragTarget = null;
            }, RESET_DELAY);
        } else {
            AudioPlayer.state.isDragging = false;
            hasDragged = false;
            dragTarget = null;
        }
    };

    // Manejar casos donde el mouse sale de la ventana durante el arrastre
    const handleMouseLeave = () => {
        if (isMouseDown && hasDragged) {
            stopDrag();
        }
    };

    // Event listeners con mejor manejo de eventos
    document.addEventListener('mousedown', startDrag, { passive: true });
    document.addEventListener('mousemove', duringDrag, { passive: false });
    document.addEventListener('mouseup', stopDrag, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    
    // Touch events con manejo mejorado
    document.addEventListener('touchstart', startDrag, { passive: true });
    document.addEventListener('touchmove', duringDrag, { passive: false });
    document.addEventListener('touchend', stopDrag, { passive: true });
    document.addEventListener('touchcancel', stopDrag, { passive: true });

    // Prevenir arrastre de imágenes que puedan interferir
    document.addEventListener('dragstart', (e) => {
        if (e.target.closest('.audio-player') || e.target.closest('.show-avatar-area')) {
            e.preventDefault();
        }
    });
})();