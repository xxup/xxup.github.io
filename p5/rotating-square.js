let angle = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);
}

function draw() {
  background(0, 10);
  translate(width / 2, height / 2);
  rotate(angle);
  noFill();
  stroke(255, 100, 200);
  strokeWeight(2);
  rect(-50, -50, 100, 100);
  angle += 0.01;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}