function debounce(e, t, n) {
    var i;
    return function() {
        var a = this,
            o = arguments,
            r = function() {
                i = null, n || e.apply(a, o)
            },
            c = n && !i;
        clearTimeout(i), i = setTimeout(r, t), c && e.apply(a, o)
    }
}
function createBase64Image(e, t) {
    function n(n) {
        var i = document.createElement("canvas");
        e.imageWidth && (n.width = e.imageWidth), e.imageHeight && (n.height = e.imageHeight), i.width = e.canvasWidth || n.width, i.height = e.canvasHeight || n.height;
        var a = i.getContext("2d");
        a.drawImage(n, i.width / 2 - n.width / 2, i.height / 2 - n.height / 2, n.width, n.height);
        var o = i.toDataURL("image/png"),
            r = new Image;
        r.onload = function() {
            t && t(r)
        }, r.src = o
    }
    if (e || (e = {
        image: domReference,
        imageWidth: 500,
        imageHeight: 500,
        canvasWidth: window.innerWidth,
        canvasHeight: window.innerHeight
    }), "string" == typeof e.image) {
        var i = new Image;
        i.onload = function() {
            n(i)
        }, i.src = e.image
    } else
        n(e.image)
}
function shuffleArray(e) {
    for (var t = e.slice(), n = t.length - 1; n > 0; n--) {
        var i = Math.floor(Math.random() * (n + 1)),
            a = t[n];
        t[n] = t[i], t[i] = a
    }
    return t
}
function vmin(e) {
    e || (e = 1);
    var t = Math.min(window.innerWidth, window.innerHeight);
    return t * e
}
document.addEventListener("touchmove", function(e) {
    e.preventDefault()
}), window.addEventListener("load", function() {
    function e() {
        var e = a.getBoundingClientRect(),
            t = c.getBoundingClientRect(),
            n = {
                x: e.width / t.width,
                y: e.height / t.height
            },
            i = t.height + t.y,
            o = e.y - i + e.height;
        c.style.transform = "translate(0," + o + "px) scale(" + n.x + ", " + n.y + ")"
    }
    function t() {
        e(), r.innerText = "Contact Me", a.classList.toggle("active"), i.classList.toggle("open"), h = !1
    }
    function n() {
        e(), r.innerText = "Close", a.classList.toggle("active"), i.classList.toggle("open"), h = !0
    }
    var i = document.querySelector(".andid");
    if (i) {
        var a = document.querySelector("#andidButton"),
            o = document.querySelector(".andid__overlay"),
            r = a.querySelector(".andid__button__text"),
            c = document.querySelector(".andid__bg"),
            h = !1;
        a.addEventListener("click", function(e) {
            e.stopPropagation(), h ? (r.innerText = "Contact Me", t()) : (r.innerText = "Close", n())
        }), i.addEventListener("click", function() {
            t()
        }), o.addEventListener("click", function(e) {
            e.stopPropagation()
        }), e(), document.body.addEventListener("keydown", function(e) {
            27 == e.which && t()
        })
    }
});

(function() {
  var observer;
  var images = [].slice.call(document.querySelectorAll('.and-list__image'));
  var loadImage = function(elem) {
    var src = elem.getAttribute('data-src');
    var image = new Image();
      image.onload = function() {
        elem.style.backgroundImage = 'url('+src+')';
        elem.className += ' and-list__image--loaded';};
   image.src = src; };
   if (!('IntersectionObserver'in window)) {
     images.forEach(function(image) {
       loadImage(image);});}
         else {
           var onIntersection=function(entries) {
              entries.forEach(function(entry) {
                if (entry.intersectionRatio > 0) {
                  observer.unobserve(entry.target);
                  loadImage(entry.target);}});};
    observer = new IntersectionObserver(onIntersection,{
    rootMargin:'50px 0px',threshold:0.01,});
    images.forEach(function(image) {
    observer.observe(image);});
  }
})();


window.addEventListener('load',function(){var $toggleLongVersion=document.querySelector('#toggleLongVersion');var $longVersion=document.querySelector('#longVersion');var isHidden=true;if($toggleLongVersion){$toggleLongVersion.addEventListener('click',function(){isHidden=!isHidden;if(isHidden){$longVersion.fadeOut('fast');$toggleLongVersion.removeClass('toggled');}else{$longVersion.fadeIn('medium');$toggleLongVersion.addClass('toggled');}});}var scrollFades=[].slice.call(document.querySelectorAll('.scroll-fade'));var showScrollFade=function(elem){elem.className+=' scroll-fade--active';};if(!('IntersectionObserver'in window)){scrollFades.forEach(function(image){showScrollFade(image);});}else{var onIntersection=function(entries){entries.forEach(function(entry){if(entry.intersectionRatio>0){observer.unobserve(entry.target);showScrollFade(entry.target);}});};observer=new IntersectionObserver(onIntersection,{rootMargin:'50px 0px',threshold:0.01,});scrollFades.forEach(function(image){observer.observe(image);});}});
