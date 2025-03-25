import * as THREE from 'three';
import './audio-visualization.js';

function createAudioTerrainHero(containerSelector) {
  // Create DOM elements
  const container = document.querySelector(containerSelector);
  if (!container) return;
  
  // Create the 3D container
  const threeContainer = document.createElement('div');
  threeContainer.className = 'absolute -bottom-32 md:inset-0 z-0';
  container.appendChild(threeContainer);
  
  // Mouse position tracking
  const mousePosition = { x: 0, y: 0 };
  
  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0A0A0A);
  
  // Camera setup
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 20, 100);
  camera.lookAt(0, 0, 0);
  
  // Renderer setup
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  threeContainer.appendChild(renderer.domElement);
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xF5F5F5, 1);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);
  
  // Create audio terrain
  const terrainGeometry = new THREE.PlaneGeometry(400, 200, 50, 50);
  terrainGeometry.rotateX(-Math.PI / 2);
  
  // Material with wireframe for the tech look
  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0x0046FF,
    wireframe: true,
    emissive: 0x0046FF,
    emissiveIntensity: 0.3,
  });
  
  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  scene.add(terrain);
  
  // Get vertices for animation
  const { array: positions } = terrain.geometry.attributes.position;
  const originalPositions = positions.slice(0);
  
  // Mouse move tracking
  const handleMouseMove = (event) => {
    mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
  };
  
  window.addEventListener('mousemove', handleMouseMove);
  
  // Handle window resize
  const handleResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  
  window.addEventListener('resize', handleResize);
  
  // Animation
  const clock = new THREE.Clock();
  
  function animate() {
    const elapsedTime = clock.getElapsedTime();
    
    // Update terrain vertices to create wave effect
    for (let i = 0; i < positions.length; i += 3) {
      const x = originalPositions[i];
      const z = originalPositions[i + 2];
      
      // Create dynamic waves using sin functions
      const distanceToMouse = Math.sqrt(
        Math.pow((x / 200 + 0.5) - (mousePosition.x + 1) / 2, 2) + 
        Math.pow((z / 200 + 0.5) - (-(mousePosition.y) + 1) / 2, 2)
      );
      
      // Multiple frequency waves
      const wave1 = Math.sin(x * 0.05 + elapsedTime) * 2;
      const wave2 = Math.sin(z * 0.05 + elapsedTime * 0.8) * 2;
      
      // Mouse interaction wave
      const mouseWave = Math.sin(distanceToMouse * 10 - elapsedTime * 2) * 
                       (1 - Math.min(1, distanceToMouse * 4)) * 15;
      
      // Combine waves
      positions[i + 1] = originalPositions[i + 1] + wave1 + wave2 + mouseWave;
    }
    
    terrain.geometry.attributes.position.needsUpdate = true;
    
    // Subtle rotation of the entire terrain
    terrain.rotation.z = Math.sin(elapsedTime * 0.1) * 0.05;
    
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  
  animate();
  
  // Cleanup function
  return function cleanup() {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('resize', handleResize);
    if (threeContainer.contains(renderer.domElement)) {
      threeContainer.removeChild(renderer.domElement);
    }
    // Remove all created elements
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  };
}

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

function initSnowEffect() {
  const snowContainer = document.getElementById('snow-container');
  if (!snowContainer) return;

  // Get container dimensions
  const containerRect = snowContainer.getBoundingClientRect();
  const width = containerRect.width;
  const height = containerRect.height;

  // Create scene, camera, and renderer
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ alpha: true });
  
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0); // Transparent background
  snowContainer.appendChild(renderer.domElement);

  // Create a canvas to generate snowflake texture
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 32;
  canvas.height = 32;
  
  // Draw a soft, circular snowflake
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  
  // Create texture from canvas
  const snowflakeTexture = new THREE.CanvasTexture(canvas);

  // Create snowflakes
  const snowflakeCount = 500;
  const snowflakes = [];
  const snowflakeGeometry = new THREE.BufferGeometry();
  const vertices = [];
  const sizes = [];

  for (let i = 0; i < snowflakeCount; i++) {
    // Random position within container
    const x = Math.random() * width - width / 2;
    const y = Math.random() * height - height / 2;
    const z = Math.random() * 200 - 100;
    
    vertices.push(x, y, z);
    
    // Random sizes for variety
    const size = Math.random() * 4 + 1;
    sizes.push(size);
    
    // Store snowflake data for animation
    snowflakes.push({
      velocity: Math.random() * 0.5 + 0.1,
      wobble: Math.random() * 0.1,
      x: x,
      y: y,
      z: z,
      index: i * 3
    });
  }

  snowflakeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  snowflakeGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

  // Snowflake material with custom texture
  const snowflakeMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    map: snowflakeTexture,
    transparent: true,
    opacity: 0.8,
    size: 2,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  // Create the particle system
  const particleSystem = new THREE.Points(snowflakeGeometry, snowflakeMaterial);
  scene.add(particleSystem);

  // Position camera
  camera.position.z = 100;

  // Animation function
  function animate() {
    requestAnimationFrame(animate);
    
    const positions = snowflakeGeometry.attributes.position.array;
    
    // Update snowflake positions
    for (let i = 0; i < snowflakes.length; i++) {
      const snowflake = snowflakes[i];
      
      // Move snowflake down
      snowflake.y -= snowflake.velocity;
      
      // Add slight horizontal wobble
      snowflake.x += Math.sin(Date.now() * 0.001 + i) * snowflake.wobble;
      
      // Reset position if snowflake goes out of view
      if (snowflake.y < -height / 2) {
        snowflake.y = height / 2;
        snowflake.x = Math.random() * width - width / 2;
      }
      
      // Update position in geometry
      positions[snowflake.index] = snowflake.x;
      positions[snowflake.index + 1] = snowflake.y;
    }
    
    snowflakeGeometry.attributes.position.needsUpdate = true;
    
    renderer.render(scene, camera);
  }

  // Handle window resize
  function handleResize() {
    const newRect = snowContainer.getBoundingClientRect();
    const newWidth = newRect.width;
    const newHeight = newRect.height;
    
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
  }

  window.addEventListener('resize', handleResize);
  
  // Start animation
  animate();

  // Clean up function
  return () => {
    window.removeEventListener('resize', handleResize);
    snowContainer.removeChild(renderer.domElement);
    renderer.dispose();
  };
}

// Initialize effects
document.addEventListener('DOMContentLoaded', () => {
  initSnowEffect();
  createAudioTerrainHero('#serious-sound');
  initAudioSpectrum();
});