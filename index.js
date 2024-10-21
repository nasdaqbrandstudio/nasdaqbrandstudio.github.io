(function() {
    const elements = {};

    function assignElements() {
        elements.ad = document.querySelector('.ad');
        elements.scene1 = document.getElementById('scene-1');
        elements.logo1 = document.getElementById('logo1');
        elements.type11 = document.getElementById('type1-1');
        elements.type12 = document.getElementById('type1-2');
        elements.type13 = document.getElementById('type1-3');
        elements.typeAll1 = document.getElementById('typeAll1Cont');
        elements.type21 = document.getElementById('type2-1');
        elements.type22 = document.getElementById('type2-2');
        elements.type23 = document.getElementById('type2-3');
        elements.typeAll2 = document.getElementById('typeAll2Cont');
        elements.background2 = document.getElementById('background2');
        elements.white = document.getElementById('white');
        elements.white2 = document.getElementById('white2');
        elements.white3 = document.getElementById('white3');
        elements.yellow = document.getElementById('yellow');
        elements.yellow2 = document.getElementById('yellow2');
        elements.yellow3 = document.getElementById('yellow3');
        elements.images = document.getElementById('images');
        elements.image1Cont = document.getElementById('image-1Cont');
        elements.image2Cont = document.getElementById('image-2Cont');
        elements.image3Cont = document.getElementById('image-3Cont');
        elements.image4Cont = document.getElementById('image-4Cont');
        elements.logo2 = document.getElementById('logo2');
        elements.letsRethink = document.getElementById('letsRethink');
        elements.possibility = document.getElementById('possibility');
        elements.legal = document.getElementById('legal');
        elements.cutline = document.getElementById('cutline');
        elements.cta1 = document.getElementById('cta1');
        elements.cta2 = document.getElementById('cta2');
        elements.rethinkMotionCont = document.getElementById('rethinkMotionCont');
    }

    function initAnimation() {
        const timeline = gsap.timeline({ onComplete: onFinish });

        timeline
            .to(elements.type11, { duration: 0.3, autoAlpha: 1, y: -12, ease: "power1.out" }, 0.1)
            .to(elements.type12, { duration: 0.3, autoAlpha: 1, y: -12, ease: "power1.out" }, 0.3)
            .to(elements.type13, { duration: 0.3, autoAlpha: 1, y: -12, ease: "power1.out" }, 1.3)
            .to(elements.background2, { duration: 0.7, autoAlpha: 1 }, 2.5)
            .to(elements.yellow, { duration: 0.7, autoAlpha: 1 }, 2.5)
            .to(elements.yellow2, { duration: 0.7, autoAlpha: 1 }, 2.5)
            .to(elements.yellow3, { duration: 0.7, autoAlpha: 1 }, 2.5)
            .to(elements.typeAll1, { duration: 0.7, autoAlpha: 1 }, 2.5)
            .to(elements.white, { duration: 0.7, y: 70, ease: "power1.out" }, 3)
            .to(elements.white2, { duration: 0.7, rotation: 3, x: 5, ease: "power1.out" }, 3)
            .to(elements.white3, { duration: 0.7, rotation: 35, x: 90, y: -70, ease: "power1.out" }, 3)
            .to(elements.yellow, { duration: 0.7, y: 70, ease: "power1.out" }, 3)
            .to(elements.yellow2, { duration: 0.7, rotation: 3, x: 5, ease: "power1.out" }, 3)
            .to(elements.yellow3, { duration: 0.7, rotation: 35, x: 90, y: -70, ease: "power1.out" }, 3)
            .to(elements.type21, { duration: 0.3, autoAlpha: 1, y: -12, ease: "power1.out" }, 3)
            .to(elements.type22, { duration: 0.3, autoAlpha: 1, y: -12, ease: "power1.out" }, 3.2)
            .to(elements.type23, { duration: 0.3, autoAlpha: 1, y: -12, ease: "power1.out" }, 3.4)
            .to(elements.logo2, { duration: 0.2, autoAlpha: 1 }, 2.5)
            .to(elements.white, { duration: 1, rotation: -3, y: 0, ease: "power1.out" }, 6.3)
            .to(elements.white2, { duration: 1, rotation: 0, x: -5, ease: "power1.out" }, 7.3)
            .to(elements.white3, { duration: 1, rotation: 10, x: 20, y: -20, ease: "power1.out" }, 6.3)
            .to(elements.yellow, { duration: 1, rotation: -3, y: 0, ease: "power1.out" }, 6.3)
            .to(elements.yellow2, { duration: 1, rotation: 0, x: -5, ease: "power1.out" }, 7.3)
            .to(elements.yellow3, { duration: 1, rotation: 10, x: 20, y: -20, ease: "power1.out" }, 6.3)
            .to(elements.white, { duration: 0.7, autoAlpha: 0 }, 7)
            .to(elements.white2, { duration: 0.7, autoAlpha: 0 }, 7)
            .to(elements.white3, { duration: 0.7, autoAlpha: 0 }, 7)
            .to(elements.image3Cont, { duration: 0.3, clip: "rect(0px, 635px, 250px, 0px)", ease: "power4.out" }, 7)
            .to(elements.image3, { duration: 3.9, y: 45, ease: "power1.out" }, 7)
            .to(elements.image4Cont, { duration: 0.3, clip: "rect(0px, 335px, 250px, 0px)", ease: "power4.out" }, 7.4)
            .to(elements.image4, { duration: 3.3, x: 34, ease: "power1.out" }, 7.4)
            .to(elements.image2Cont, { duration: 0.3, clip: "rect(0px, 280px, 250px, 0px)" }, 7.4)
            .to(elements.image2, { duration: 3.3, x: -30, ease: "power2.out" }, 7.4)
            .to(elements.image1Cont, { duration: 0.3, clip: "rect(0px, 280px, 115px, 0px)" }, 7.8)
            .to(elements.image1, { duration: 3.3, y: -30, ease: "power2.out" }, 7.8)
            .to(elements.typeAll2, { duration: 0, autoAlpha: 0 }, 7.7)
            .to(elements.yellow, { duration: 0, autoAlpha: 1 }, 9)
            .to(elements.yellow2, { duration: 0, autoAlpha: 1 }, 9)
            .to(elements.yellow, { duration: 0.6, y: 40, ease: "power1.out" }, 9)
            .to(elements.yellow2, { duration: 0.8, rotation: 4, x: 25, ease: "power1.out" }, 9)
            .to(elements.image1Cont, { duration: 0.2, clip: "rect(115px, 280px, 115px, 0px)" }, 9)
            .to(elements.image2Cont, { duration: 0.2, clip: "rect(0px, 280px, 250px, 280px)" }, 9.3)
            .to(elements.image4Cont, {