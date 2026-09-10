let x = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(30);
}

function draw() {
  fill(255, 100);
  noStroke();
  ellipse(mouseX, mouseY, 30, 30);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}