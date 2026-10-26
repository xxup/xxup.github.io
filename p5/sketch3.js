var circle, col, rot, r;

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(0);
  translate(width/2, height/2);
  rotate(radians(rot));

  ellipseMode(RADIUS);
  for (var i=0; i<500; i++) {
    circle= 150 + 50*sin(millis()*0.000005*i);
    col=map(circle,100,200,255,60);
    r=map(circle,100,200,4,2);
    fill(col,0,74);
    noStroke();
    ellipse(circle*cos(i), circle*sin(i),r,r);    
    rot=rot+0.00005;
  }
}