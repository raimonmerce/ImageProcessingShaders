import * as THREE from 'https://cdn.skypack.dev/three@0.136.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/libs/lil-gui.module.min';

function IVimageProcessing ( height, width, imageProcessingMaterial )
{
    this.height = height;
    this.width = width;

    //3 rtt setup
    this.scene = new THREE.Scene();
    this.orthoCamera = new THREE.OrthographicCamera(-1,1,1,-1,1/Math.pow( 2, 53 ),1 );

    //4 create a target texture
    var options = {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        //            type:THREE.FloatType
        type:THREE.UnsignedByteType
    };
    this.rtt = new THREE.WebGLRenderTarget( width, height, options);

    var geom = new THREE.BufferGeometry();
    geom.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,-1, 0, 1, 1, 0, -1,1,0 ]), 3 ) );
    geom.setAttribute( 'uv', new THREE.BufferAttribute( new Float32Array([ 0,1, 1,1, 1,0, 0,1, 1,0, 0,0 ]), 2 ) );
    this.scene.add( new THREE.Mesh( geom, imageProcessingMaterial ) );
}

function IVprocess ( imageProcessing, renderer )
{
    renderer.setRenderTarget( imageProcessing.rtt );
    renderer.render ( imageProcessing.scene, imageProcessing.orthoCamera ); 	
    renderer.setRenderTarget( null );
};

let camera, controls, scene, renderer, container, planSource, planProcessed;

// VIDEO AND THE ASSOCIATED TEXTURE
let imageProcessing, extraImageProcessing, imageProcessingMaterial;

// GUI
let gui;


//Materials
let imgTransMat, imgArithMat, gaussianMat, laplacianMat, sepMat, horMat, knnMat, colMat;

let height, width, texture, image, webcam, video, videoTexture, webcamTexture;

//API
let generalAPI, scaleAPI, combinationAPI, gaussianAPI, gaussianSepAPI, knnAPI, colAPI;

let type = "image"
let sourceImage = "grenouille.jpg";
let sourceVideo = "video.mp4";

let operator = ["+", "-", "*", "/"];
let source2 = ["image", "video", "webcam"];
let filters = ["Scaling", "Adding Source", "Gaussian Filter", "Laplacian Filter", "Separable Gaussian Filter", "K-nearest neighbor", "Color Transformation"];

init();
animate();

function init () {
	let queryString = window.location.search;
	let urlParams = new URLSearchParams(queryString);
	let sourceURL = urlParams.get('sourceimage');
	if (sourceURL === null) console.log("You should add '?sourceimage=type' in the url");
	else {
		if (sourceURL == "video") type = "video";
		else if (sourceURL == "webcam") type = "webcam";
		else if (sourceURL != "image") console.log("sourceimage type is not correct");
		//image, video or webcam
	}

    container = document.createElement( 'div' );
    document.body.appendChild( container );

    scene = new THREE.Scene(); 

    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
    renderer.autoClear = false;
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = false;

    container.appendChild( renderer.domElement );

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.001, 10 );
    camera.position.z = 0.7;
    controls = new OrbitControls( camera, renderer.domElement );
    controls.minDistance = 0.005;
    controls.maxDistance = 2.0;
    controls.enableRotate = true;
    controls.addEventListener( 'change', render );
    controls.update();

    //API
    generalAPI = {
        filter: filters[0]
    };

    scaleAPI = {
        scaleFactor: 1.0,
        bilinearFiltering: true
    };

    combinationAPI = {
        operator: operator[0],
        source2: source2[0]
    };

    gaussianAPI = {
        ksize: 3,
        sigma: 0.05
    };

    gaussianSepAPI = {
        ksize: 3,
        sigma: 0.05
    };

    knnAPI = {
        ksize: 3,
        percent: 0.0
    };

    colAPI = {
        angle: 0
    };

	console.log(type);
    //Webcam
    webcam = document.createElement('video');
    if ( navigator.mediaDevices && navigator.mediaDevices.getUserMedia ) {
        const constraints = { video: { width: 1920, height: 1080, facingMode: 'user' } };
        navigator.mediaDevices.getUserMedia( constraints ).then( function ( stream ) {
            webcam.srcObject = stream;
            webcam.play();
        })
    }

    //Video
    video = document.createElement('video');
    video.src = sourceVideo;
    video.load();
    video.muted = true;
    video.loop = true;
    video.play();

    video.onloadeddata = function (){ 
        videoTexture = new THREE.VideoTexture( video );
        videoTexture.minFilter = THREE.NearestFilter;
        videoTexture.magFilter = THREE.NearestFilter;
        videoTexture.generateMipmaps = false; 
        videoTexture.format = THREE.RGBFormat;
        webcam.onloadeddata = function (){ 
            webcamTexture = new THREE.VideoTexture( webcam );
            webcamTexture.minFilter = THREE.NearestFilter;
            webcamTexture.magFilter = THREE.NearestFilter;
            webcamTexture.generateMipmaps = false; 
            webcamTexture.format = THREE.RGBFormat;

            let loader = new THREE.TextureLoader();
            loader.load( sourceImage,  function (newtexture) {
                image = newtexture;
                if (type == "webcam") {
                    height = webcam.videoHeight;
                    width = webcam.videoWidth;
                    texture = webcamTexture;
                } else if(type == "video") {
                    height = video.videoHeight;
                    width = video.videoWidth;
                    texture = videoTexture;
                } else {
                    height = image.image.height;
                    width = image.image.width;
                    texture = image;
                }
                continueLoading()
            });
        } 
    }
};

function continueLoading(){
    declareMaterials()
    var geometry = new THREE.PlaneGeometry( 1, height/width );
    planProcessed = new THREE.Mesh( geometry, getMaterials(imgTransMat) );
	planProcessed.position.x = 0.5;
    planProcessed.receiveShadow = false;
    planProcessed.castShadow = false;
    scene.add( planProcessed );

    var materialProcessed = new THREE.MeshBasicMaterial( { map: texture, side : THREE.DoubleSide } );
    planSource = new THREE.Mesh( geometry, materialProcessed );
    planSource.position.x = -0.5;
    planSource.receiveShadow = false;
    planSource.castShadow = false;
    scene.add( planSource );

    addGUI();
    javascript:(function(){var script=document.createElement('script');
    script.onload=function(){var stats=new Stats();
        document.body.appendChild(stats.dom);
        requestAnimationFrame(function loop(){
            stats.update();
            requestAnimationFrame(loop)});
    };
    script.src='//mrdoob.github.io/stats.js/build/stats.min.js';
    document.head.appendChild(script);
    })()
    
    window.addEventListener( 'resize', onWindowResize, false );
}

function gaussianMatrix(ksize, sigma){

    let GKernel = new Array(ksize);

    for (let i = 0; i < GKernel.length; i++) {
        GKernel[i] = new Array(ksize);
    }

    let r;
    let s = 2.0 * sigma * sigma;
    let val = (ksize - 1)/2;
 
    // sum is for normalization
    let sum = 0.0;
 
    // generating 5x5 kernel
    for (let x = -val; x <= val; x++) {
        for (let y = -val; y <= val; y++) {
            r = Math.sqrt(x * x + y * y);
            GKernel[x + val][y + val] = (Math.exp(-(r * r) / s)) / (Math.PI * s);
            sum += GKernel[x + val][y + val];
        }
    }

    let mat = Array(225).fill(0.0);

    // normalising the Kernels
    for (let i = 0; i < ksize; ++i)
        for (let j = 0; j < ksize; ++j)
            mat[i*ksize+j] = GKernel[i][j] / sum;
    console.log();
    return mat;
}

function getGausVector(matGauss, ksize){
    let Vec = new Array(ksize);
    for (let i = 0; i < ksize; i++) {
        let tmp = 0;
        for (let j = 0; j < ksize; j++) {
            tmp += matGauss[i*ksize + j];
        }
        Vec[i] = tmp;
    } 
    return Vec;
}

function declareMaterials(){
    imgTransMat = new THREE.ShaderMaterial({
        uniforms: {
            image: { type: 't', value: texture },
            scaleFactor: { type: 'f', value: 1.0 },
            bilinearFiltering: { type: 'b', value: true }
        },
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('imgTransMatFrag').text,
    });

    imgArithMat = new THREE.ShaderMaterial({
        uniforms: {
            source1: {type: 't', value: texture},
            source2: {type: 't', value: image},
            operator: {type: 'i', value: 0} 
        },
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('imgArithMatFrag').text,
    });

    let matGauss = gaussianMatrix(3, 0.05);
    let matLapl = [0.0, -1.0, .0,-1.0, 4.0, -1.0, 0.0, -1.0, 0.0];
    let gaussVec = getGausVector(matGauss, 3);
    let tmpArr = Array(216).fill(0.0);
    matLapl = matLapl.concat(tmpArr);
    
    console.log(matGauss);
    console.log(matLapl);
    console.log(gaussVec);

    gaussianMat = new THREE.ShaderMaterial({
        uniforms: {
            image: {type: 't', value: texture},
            mat: {type: 'f', value: matGauss},
            ksize: {type: 'i', value: 3}
        },
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('convMatFrag').text,
    });

    laplacianMat = new THREE.ShaderMaterial({
        uniforms: {
            image: {type: 't', value: texture},
            mat: {type: 'f', value: matLapl},
            ksize: {type: 'i', value: 3}
        },
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('convMatFrag').text,
    });
    
    horMat = new THREE.ShaderMaterial({
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('horMatFrag').text,
        uniforms: {
            image: { type: 't', value: texture },
            vec: {type: 'f', value: gaussVec},
            ksize: {type: 'i', value: 3}
        }
    });
    
    extraImageProcessing = new IVimageProcessing(height, width, horMat);

    sepMat = new THREE.ShaderMaterial({
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('vertMatFrag').text,
        uniforms: {
            image: { type: 't', value: extraImageProcessing.rtt.texture },
            vec: {type: 'f', value: gaussVec},
            ksize: {type: 'i', value: 3}
        }
    });
    
    knnMat = new THREE.ShaderMaterial({
        uniforms: {
            image: {type: 't', value: texture},
            ksize: {type: 'i', value: 3},
            percent: {type: 'i', value: 0}
        },
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('knnMatFrag').text,
    });

    colMat = new THREE.ShaderMaterial({
        uniforms: {
            image: {type: 't', value: texture},
            rad: {type: 'f', value: 0.0},
        },
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('colMatFrag').text,
    });
}

function getMaterials(imageProcessingMaterial){
    imageProcessing = new IVimageProcessing ( height, width, imageProcessingMaterial );
    return new THREE.MeshBasicMaterial( { map: imageProcessing.rtt.texture, side : THREE.DoubleSide } );
}

function changeFilter(value){
    if (value == "Scaling"){
        planProcessed.material = getMaterials(imgTransMat)
    } else if (value == "Adding Source"){
        planProcessed.material = getMaterials(imgArithMat)
    } else if (value == "Gaussian Filter"){
        planProcessed.material = getMaterials(gaussianMat)
    } else if (value == "Laplacian Filter"){
        planProcessed.material = getMaterials(laplacianMat)
    } else if (value == "Separable Gaussian Filter"){
        planProcessed.material = getMaterials(sepMat)
    } else if (value == "K-nearest neighbor"){
        planProcessed.material = getMaterials(knnMat)
    } else if (value == "Color Transformation"){
        planProcessed.material = getMaterials(colMat)
    } else {
        planProcessed.material = getMaterials(imgTransMat)
    }
}

function changeSource(value){
    if (value == "image"){
        imgArithMat.uniforms.source2.value = image
    } else if (value == "video"){
        imgArithMat.uniforms.source2.value = videoTexture
    } else {
        imgArithMat.uniforms.source2.value = webcamTexture
    }
}

function changeOperator(value){
    if (value == "+"){
        imgArithMat.uniforms.operator.value = 0
    } else if (value == "-"){
        imgArithMat.uniforms.operator.value = 1
    } else if (value == "*"){
        imgArithMat.uniforms.operator.value = 2
    } else {
        imgArithMat.uniforms.operator.value = 3
    }
}

function addGUI(){
    gui = new GUI( { title: "Image Transformation" } );

    let folder = gui.addFolder("Filter");
    folder.add( generalAPI, 'filter', filters)
        .name( 'filter' )
        .onChange( function (value) {
            changeFilter(value);
        } );
    folder = gui.addFolder("Scaling");
    folder.add( scaleAPI, 'scaleFactor', 0.2, 5, 0.2)
        .name( 'scaleFactor' )
        .onChange( function (value) {
            if ((value*10)%2 != 0) scaleAPI.scaleFactor = value - 0.1;
            imgTransMat.uniforms.scaleFactor.value = scaleAPI.scaleFactor;
        } );
    folder.add( scaleAPI, 'bilinearFiltering')
        .name( 'bilinearFiltering')
        .onChange( function () {
            imgTransMat.uniforms.bilinearFiltering.value = scaleAPI.bilinearFiltering;
        } );

    folder = gui.addFolder("Adding Source");
    folder.add( combinationAPI, 'source2', source2)
        .name( 'source' )
        .onChange( function (value) {
            changeSource(value);
        } );
    folder.add( combinationAPI, 'operator', operator)
        .name( 'operator' )
        .onChange( function (value) {
            changeOperator(value);
        } );
    
    folder = gui.addFolder("Gaussian Filter");
    folder.add( gaussianAPI, 'ksize', 3, 15, 2)
        .name( 'ksize' )
        .onChange( function (value) {
            if (value%2 == 0) gaussianAPI.ksize = value - 1;
            console.log("ksize: " + gaussianAPI.ksize + " sigma: " + gaussianAPI.sigma);
            gaussianMat.uniforms.ksize.value = gaussianAPI.ksize;
            gaussianMat.uniforms.mat.value = gaussianMatrix(gaussianAPI.ksize, gaussianAPI.sigma);
        } );
    folder.add( gaussianAPI, 'sigma', 0.01, 5.0, 0.01)
        .name( 'sigma' )
        .onChange( function (value) {
            console.log("ksize: " + gaussianAPI.ksize + " sigma: " + gaussianAPI.sigma);
            gaussianMat.uniforms.mat.value = gaussianMatrix(gaussianAPI.ksize, gaussianAPI.sigma);
        } );
    
    folder = gui.addFolder("Separable Gaussian Filter");
    folder.add( gaussianSepAPI, 'ksize', 3, 15, 2)
        .name( 'ksize' )
        .onChange( function (value) {
            if (value%2 == 0) gaussianSepAPI.ksize = value - 1;
            horMat.uniforms.ksize.value = gaussianSepAPI.ksize;
            sepMat.uniforms.ksize.value = gaussianSepAPI.ksize;
            let gaussVec = getGausVector(gaussianMatrix(gaussianSepAPI.ksize, gaussianSepAPI.sigma), gaussianSepAPI.ksize);
            horMat.uniforms.vec.value = gaussVec;
            sepMat.uniforms.vec.value = gaussVec;
        } );
    folder.add( gaussianSepAPI, 'sigma', 0.05, 5.0, 0.01)
        .name( 'sigma' )
        .onChange( function (value) {
            let gaussVec = getGausVector(gaussianMatrix(gaussianSepAPI.ksize, gaussianSepAPI.sigma), gaussianSepAPI.ksize);
            horMat.uniforms.vec.value = gaussVec;
            sepMat.uniforms.vec.value = gaussVec;
        } );

    folder = gui.addFolder("K-nearest neighbor");
    folder.add( knnAPI, 'ksize', 3, 15, 2)
        .name( 'ksize' )
        .onChange( function (value) {
            if (value%2 == 0) knnAPI.ksize = value - 1;
            knnMat.uniforms.ksize.value = knnAPI.ksize;
        });
    folder.add( knnAPI, 'percent', 0, 100, 1)
        .name( 'percent' )
        .onChange( function () {
            knnMat.uniforms.percent.value = knnAPI.percent;
        });

    folder = gui.addFolder("Color Transformation");
    folder.add( colAPI, 'angle', 0, 360, 1)
        .name( 'angle' )
        .onChange( function () {
            console.log(colAPI.angle*(Math.PI/180))
            colMat.uniforms.rad.value = colAPI.angle*(Math.PI/180);
        });
}

function render () {
    renderer.clear();

    if (typeof imageProcessing !== 'undefined') 
        IVprocess ( imageProcessing, renderer );
    if (typeof extraImageProcessing !== 'undefined') 
        IVprocess ( extraImageProcessing, renderer );
    renderer.render( scene, camera );

}

function animate() {	
    requestAnimationFrame(animate);
    controls.update();
    render();
}

function onWindowResize () {
    camera.aspect = ( window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    render();
}
