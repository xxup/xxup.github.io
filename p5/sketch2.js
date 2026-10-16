var particles = [];
var nums;
var particleDensity = 4000;
var noiseScale = 800;
var maxLife = 10;
var simulationSpeed = 0.2;
var fadeFrame = 0;
var backgroundColor;
var visualMode = 0;
var numModes = 2;

function setup() {
   nums = windowWidth * windowHeight / particleDensity;
   backgroundColor = color(20, 20, 20);
   createCanvas(windowWidth, windowHeight);
   background(backgroundColor);
   for (var i = 0; i < nums; i++) {
      particles[i] = new Particle();
   }
}

function draw() {
   noStroke();
   
   ++fadeFrame;
   if (fadeFrame % 5 == 0) {
      blendMode(DIFFERENCE);
      fill(1, 1, 1);
      rect(0, 0, width, height);
      
      blendMode(LIGHTEST);
      fill(backgroundColor);
      rect(0, 0, width, height);
   }
   
   blendMode(BLEND);
   smooth();
   for (var i = 0; i < nums; i++) {
      var iterations = map(i, 0, nums, 5, 1);
      var radius = map(i, 0, nums, 2, 6);
      
      particles[i].move(iterations);
      particles[i].checkEdge();
      
      var alpha = 255;
      var particleColor;
      var fadeRatio;
      fadeRatio = min(particles[i].life * 5 / maxLife, 1);
      fadeRatio = min((maxLife - particles[i].life) * 5 / maxLife, fadeRatio);
      
      var colorCase = visualMode + 2;
      
      switch(colorCase) {
         case 2:
         particleColor = particles[i].color;
         break;
         case 3:
         particleColor = color(blue(particles[i].color) + 70, green(particles[i].color) + 20, red(particles[i].color) - 50);
         break;
      }
      fill(red(particleColor), green(particleColor), blue(particleColor), alpha * fadeRatio);
      particles[i].display(radius);
   }
}

function Particle() {
   this.vel = createVector(0, 0);
   this.pos = createVector(random(0, width), random(0, height));
   this.life = random(0, maxLife);
   this.flip = int(random(0, 2)) * 2 - 1;
   var randColor = int(random(0, 3));
   switch(randColor) {
      case 0:
      this.color = color(110, 57, 204);
      break;
      case 1:
      this.color = color(7, 153, 242);
      break;
      case 2:
      this.color = color(255, 255, 255);
      break;
   }
   
   this.move = function(iterations) {
      if ((this.life -= 0.01666) < 0)
      this.respawn();
      while (iterations > 0) {
         var angle = noise(this.pos.x/noiseScale, this.pos.y/noiseScale)*TWO_PI*noiseScale*this.flip;
         this.vel.x = cos(angle);
         this.vel.y = sin(angle);
         this.vel.mult(simulationSpeed);
         this.pos.add(this.vel);
         --iterations;
      }
   }
   
   this.checkEdge = function() {
      if (this.pos.x > width || this.pos.x < 0 || this.pos.y > height || this.pos.y < 0) {
         this.respawn();
      }
   }
   
   this.respawn = function() {
      this.pos.x = random(0, width);
      this.pos.y = random(0, height);
      this.life = maxLife;
   }
   
   this.display = function(r) {
      ellipse(this.pos.x, this.pos.y, r, r);
   }
}

function advanceVisual() {
   visualMode = ++visualMode % numModes;
   noiseSeed(random()*Number.MAX_SAFE_INTEGER);
   background(backgroundColor);
   for (var i = 0; i < nums; i++) {
      particles[i].respawn();
      particles[i].life = random(0, maxLife);
   }
}

var lastAdvanceTime = 0;

function handleAdvance() {
   var now = millis();
   if (now - lastAdvanceTime < 250) return;
   lastAdvanceTime = now;
   advanceVisual();
}

function touchStarted() {
   handleAdvance();
   return false;
}

function mousePressed() {
   if (typeof touches !== 'undefined' && touches.length > 0) return;
   handleAdvance();
}