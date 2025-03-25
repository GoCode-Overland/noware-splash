
// Audio Spectrum
function initAudioSpectrum() {
  const muteBtn = document.getElementById('muteButton');
  const video = document.getElementById('audioVideo');
  const canvas = document.getElementById('audioSpectrum');
  const ctx = canvas.getContext('2d');
  
  // Variables for pre-recorded data playback
  let frequencyData = null;
  let isPlaying = false;
  let playbackStartTime = 0;
  let currentSampleIndex = 0;
  let absoluteTimes = [];

  const handleMute = () => {
    video.muted = !video.muted;
    muteBtn.querySelector('[data-unmute]').classList.toggle('hidden');
    muteBtn.querySelector('[data-mute]').classList.toggle('hidden');
  }
  // Hook up mute button
  muteBtn.addEventListener('click', handleMute);
  video.addEventListener('click', handleMute);
  
  // Load the pre-recorded frequency data
  async function loadFrequencyData(url) {
      try {
          const response = await fetch(url);
          if (!response.ok) {
              throw new Error(`Failed to load frequency data: ${response.status}`);
          }
          
          frequencyData = await response.json();
          // console.log('Loaded frequency data:', 
          //     `${frequencyData.samples.length} samples, ` +
          //     `${frequencyData.frequencyBinCount} frequency bins`);
          
          // Pre-calculate absolute timestamps for efficient playback
          let currentTime = 0;
          absoluteTimes = frequencyData.samples.map(sample => {
              currentTime += sample.dt;
              return currentTime;
          });
          
          // Initialize visualization once data is loaded
          initVisualization();
      } catch (error) {
          console.error('Error loading frequency data:', error);
      }
  }
  
  // Initialize visualization with pre-recorded data
  function initVisualization() {
      if (!video.paused) {
          startPlayback();
      }
      // Set up video event listeners
      video.addEventListener('play', () => {
          startPlayback();
      });
      
      video.addEventListener('pause', () => {
          pausePlayback();
      });
      
      video.addEventListener('seeking', () => {
          // Find the appropriate sample index based on video time
          syncPlaybackToVideoTime();
      });
  }
  
  // Start playback of frequency data
  function startPlayback() {
      if (!frequencyData) return;
      
      isPlaying = true;
      playbackStartTime = Date.now() - (video.currentTime * 1000);
      
      // If we're starting from the middle, find the right sample
      syncPlaybackToVideoTime();
      
      // Start the visualization loop
      requestAnimationFrame(draw);
  }
  
  // Pause playback
  function pausePlayback() {
      isPlaying = false;
  }
  
  // Sync the frequency data playback to the current video time
  function syncPlaybackToVideoTime() {
      if (!frequencyData) return;
      
      const videoTimeMs = video.currentTime * 1000;
      playbackStartTime = Date.now() - videoTimeMs;
      
      // Find the sample index closest to the current video time
      currentSampleIndex = 0;
      while (currentSampleIndex < absoluteTimes.length && 
             absoluteTimes[currentSampleIndex] < videoTimeMs) {
          currentSampleIndex++;
      }
      
      // Draw the current frame immediately
      if (currentSampleIndex < frequencyData.samples.length) {
          drawFrame(frequencyData.samples[currentSampleIndex].f);
      }
  }
  
  // Main visualization loop
  function draw() {
      if (!isPlaying) return;
      
      const elapsedTime = Date.now() - playbackStartTime;
      
      // Find the current sample based on elapsed time
      while (currentSampleIndex < absoluteTimes.length && 
             absoluteTimes[currentSampleIndex] <= elapsedTime) {
          currentSampleIndex++;
      }
      
      // If we've reached the end of the data, loop back to the beginning
      if (currentSampleIndex >= frequencyData.samples.length) {
          if (video.loop) {
              currentSampleIndex = 0;
              playbackStartTime = Date.now();
          } else {
              isPlaying = false;
              return;
          }
      }
      
      // Draw the current frequency data
      drawFrame(frequencyData.samples[currentSampleIndex].f);
      
      // Continue the loop
      requestAnimationFrame(draw);
  }
  
  // Draw a single frame of frequency data
  function drawFrame(dataArray) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const bufferLength = dataArray.length;
      const spacing = window.innerWidth > 768 ? 6 : 1; // Configurable space between bars in pixels
      const totalSpacing = (bufferLength - 1) * spacing;
      const barWidth = (canvas.width - totalSpacing) / bufferLength;
      const barRadius = barWidth / 2;
      
      dataArray.forEach((value, i) => {
          const percent = value / 256;
          const height = Math.max(canvas.height * percent, 2);
          const x = i * (barWidth + spacing); // Add spacing between bars
          const y = (canvas.height - height) / 2; // Center vertically
          
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, height, barRadius);
          ctx.fill();
      });
  }
  
  // Load the pre-recorded data
  // Replace 'path/to/frequency-data.json' with your actual data file path
  loadFrequencyData('img/audio-frequencies.json');
}

// Audio Diagram
function initAudioDiagram() {
   // Get references to elements
   const diagram = document.getElementById('diagram');
   const audioVideo = document.getElementById('audioVideo');
   let currentMode = null;
   const headings = {
     idle: null,
     drive: document.querySelector('#DRIVE_HEADING'),
     camp: document.querySelector('#CAMP_HEADING'),
     flex: document.querySelector('#FLEX_HEADING')
   };
   
   if (!diagram || !audioVideo) return;
   
   // Get all speaker elements
   const allSpeakers = [
     ...Array.from(diagram.querySelectorAll('#CAMP_MODE [id^="speaker"]')),
     ...Array.from(diagram.querySelectorAll('#FULL_FLEX [id^="sub"]')),
     ...Array.from(diagram.querySelectorAll('#SHARED [id^="sub"]')),
     ...Array.from(diagram.querySelectorAll('#DRIVE_MODE [id^="speaker"]'))
   ];
   
   // Initialize mode elements
   const modes = {
     idle: allSpeakers,
     drive: [
       ...Array.from(diagram.querySelectorAll('#SHARED [id^="sub"]')),
       ...Array.from(diagram.querySelectorAll('#DRIVE_MODE [id^="speaker"]'))
     ],
     camp: [
       ...Array.from(diagram.querySelectorAll('#CAMP_MODE [id^="speaker"]')),
       ...Array.from(diagram.querySelectorAll('#SHARED [id^="sub"]'))
     ],
     flex: [
       ...Array.from(diagram.querySelectorAll('#FULL_FLEX [id^="sub"]')),
       ...Array.from(diagram.querySelectorAll('#SHARED [id^="sub"]')),
       ...Array.from(diagram.querySelectorAll('#CAMP_MODE [id^="speaker"]')),
       ...Array.from(diagram.querySelectorAll('#DRIVE_MODE [id^="speaker"]'))
     ]
   };
   
   // Create ripple circles for each speaker
   function createRippleCircles() {
     allSpeakers.forEach(speaker => {
       // Find the circle element inside the speaker
       const speakerCircle = speaker.querySelector('circle');
       if (!speakerCircle) return;
       
       // Get the center coordinates and determine if it's a sub (blue) or speaker (pink)
       const cx = parseFloat(speakerCircle.getAttribute('cx'));
       const cy = parseFloat(speakerCircle.getAttribute('cy'));
       const isSub = speaker.id.includes('sub');
       
       // Create 3 ripple circles for each speaker
       for (let i = 0; i < 3; i++) {
         const ripple = document.createElementNS("http://www.w3.org/2000/svg", "circle");
         ripple.setAttribute('cx', cx);
         ripple.setAttribute('cy', cy);
         ripple.setAttribute('r', '0');
         ripple.classList.add('speaker-ripple');
         if (isSub) ripple.classList.add('blue');
         
         // Add the ripple to the speaker's parent
         speaker.appendChild(ripple);
       }
     });
   }
   
   // Animate ripples for active speakers
   function animateRipples() {
     const activeSpeakers = diagram.querySelectorAll('.active-speaker');
     
     activeSpeakers.forEach(speaker => {
       const ripples = speaker.querySelectorAll('.speaker-ripple');
       
       // Stagger the animations
       ripples.forEach((ripple, index) => {
         // Reset the animation
         ripple.style.animation = 'none';
         ripple.offsetHeight; // Trigger reflow
         
         // Start a new animation with delay based on index
         ripple.style.animation = `ripple 2s ease-out ${index * 0.6}s infinite`;
       });
     });
   }
   
   // Hide all modes initially
   function resetModes() {
     Object.values(headings).forEach(heading => {
       if (!heading) return;
       heading.classList.add('opacity-0');
     });
     allSpeakers.forEach(speaker => {
       speaker.classList.remove('active-speaker');
       speaker.classList.remove('idle-speaker');
       
       // Reset all ripple animations
       const ripples = speaker.querySelectorAll('.speaker-ripple');
       ripples.forEach(ripple => {
         ripple.style.animation = 'none';
       });
     });
   }
   
   // Activate a specific mode
   function activateMode(modeName) {
     if (modeName === currentMode || audioVideo.paused) return;
 
     resetModes();
     activateHeading(headings[modeName]);
 
     modes[modeName].forEach((speaker, index) => {
       if (modeName === 'idle') {
         setTimeout(()=> speaker.classList.add('idle-speaker'), index * 20);
       } else {
         speaker.classList.add('active-speaker');
       }
     });
     
     // Start ripple animations
     animateRipples();
   }
 
   function activateHeading(heading) {
     if (heading) {
       heading.classList.remove('opacity-0');
     }
   }
 
   
   // Update mode based on video time
   function updateModeBasedOnTime() {
     const currentTime = audioVideo.currentTime;
     if (currentTime < 31) {
       activateMode('idle');
       currentMode = 'idle';
     } else if (currentTime < 39) {
       activateMode('drive');
       currentMode = 'drive';
     } else if (currentTime < 42) {
       resetModes();
     } else if (currentTime < 55) {
       activateMode('camp');
       currentMode = 'camp';
     } else {
       activateMode('drive');
       currentMode = 'drive';
     }
   }
   
   // Listen for timeupdate event on video
   audioVideo.addEventListener('timeupdate', () => {
     if (!audioVideo.paused) {
       updateModeBasedOnTime();
     }
   });
   
   // Reset everything when video ends or loops
   audioVideo.addEventListener('ended', resetModes);
   
   // Initialize
   createRippleCircles();
   resetModes();
}

document.addEventListener('DOMContentLoaded', () => {
  initAudioSpectrum();
  initAudioDiagram();
}); 