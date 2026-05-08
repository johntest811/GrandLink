import 'fast-text-encoding';
import 'react-native-url-polyfill/auto';

console.log('Polyfills START');

// Polyfill DOM globals for Three.js
// @ts-ignore
if (typeof window === 'undefined') {
    // @ts-ignore
    global.window = global;
}

// Polyfill window.location (CRITICAL for Three.js loaders and OAuth)
// @ts-ignore
if (typeof window !== 'undefined' && !window.location) {
    const locationMock = {
        href: 'http://localhost',
        protocol: 'http:',
        host: 'localhost',
        hostname: 'localhost',
        port: '80',
        pathname: '/',
        search: '',
        hash: '',
        origin: 'http://localhost',
        ancestorOrigins: [] as any,
        assign: (url?: string | URL) => { 
            console.log('location.assign() called with:', url, '- ignoring in React Native');
        },
        reload: () => { 
            console.log('location.reload() called - ignoring in React Native');
        },
        replace: (url?: string | URL) => { 
            console.log('location.replace() called with:', url, '- ignoring in React Native');
        },
        toString: () => 'http://localhost',
    };
    // @ts-ignore
    window.location = locationMock as any;
} else if (typeof window !== 'undefined' && window.location && !window.location.assign) {
    // If location exists but assign is missing, add it
    // @ts-ignore
    window.location.assign = (url?: string | URL) => {
        console.log('location.assign() called with:', url, '- ignoring in React Native');
    };
}

if (typeof document === 'undefined') {
    // @ts-ignore
    global.document = {
        createElement: (tag: string) => {
            // Return dummy elements with sufficient compatibility
            if (tag === 'img') {
                // Functional Image polyfill for THREE.TextureLoader in React Native.
                // Setting .src triggers a real network fetch + decode so onload fires
                // with a proper { width, height, src } object that Three.js can use.
                let _src = '';
                let _onload: ((img: any) => void) | null = null;
                let _onerror: ((err: any) => void) | null = null;
                const listeners: Record<string, Array<(e: any) => void>> = {};

                const imgObj: any = {
                    get src() { return _src; },
                    set src(value: string) {
                        _src = value;
                        if (!value) return;
                        // Use React Native Image to decode dimensions (proves the image loaded)
                        const { Image: RNImage } = require('react-native');
                        RNImage.getSize(
                            value,
                            (w: number, h: number) => {
                                imgObj.width = w;
                                imgObj.height = h;
                                imgObj.naturalWidth = w;
                                imgObj.naturalHeight = h;
                                const evt = { target: imgObj };
                                if (_onload) _onload(imgObj);
                                (listeners['load'] || []).forEach(fn => fn(evt));
                            },
                            (err: any) => {
                                const evt = { target: imgObj, error: err };
                                if (_onerror) _onerror(err);
                                (listeners['error'] || []).forEach(fn => fn(evt));
                            }
                        );
                    },
                    width: 0, height: 0,
                    naturalWidth: 0, naturalHeight: 0,
                    style: {},
                    crossOrigin: '',
                    get onload() { return _onload; },
                    set onload(fn: any) { _onload = fn; },
                    get onerror() { return _onerror; },
                    set onerror(fn: any) { _onerror = fn; },
                    addEventListener(type: string, fn: (e: any) => void) {
                        if (!listeners[type]) listeners[type] = [];
                        listeners[type].push(fn);
                    },
                    removeEventListener(type: string, fn: (e: any) => void) {
                        if (listeners[type]) {
                            listeners[type] = listeners[type].filter(f => f !== fn);
                        }
                    },
                    setAttribute: () => { },
                };
                return imgObj;
            }
            if (tag === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    style: {},
                    getContext: () => ({
                        fillRect: () => { },
                        drawImage: () => { },
                        getImageData: () => ({ data: new Uint8ClampedArray(0) }),
                        measureText: () => ({ width: 0 }),
                        beginPath: () => { },
                        moveTo: () => { },
                        lineTo: () => { },
                        closePath: () => { },
                        stroke: () => { },
                        fill: () => { },
                        arc: () => { },
                    }),
                    toDataURL: () => '',
                    addEventListener: () => { },
                    removeEventListener: () => { },
                    setAttribute: () => { },
                } as any;
            }
            // Default dummy element
            return {
                style: {},
                setAttribute: () => { },
                appendChild: (_: any) => _,
                addEventListener: () => { },
                removeEventListener: () => { },
                textContent: '',
                classList: {
                    add: () => { },
                    remove: () => { },
                    toggle: () => { },
                    contains: () => false,
                },
            } as any;
        },
        createElementNS: (_ns: string, tag: string) => {
            return (global.document as any).createElement(tag);
        },
        body: {
            appendChild: (_: any) => _,
            removeChild: (_: any) => _,
            style: {},
        },
        head: {
            appendChild: (_: any) => _,
            removeChild: (_: any) => _,
        },
        documentElement: {
            style: {},
        },
    } as any;
}

if (typeof navigator === 'undefined') {
    // @ts-ignore
    global.navigator = {
        userAgent: 'ReactNative',
        platform: 'ReactNative',
        language: 'en-US',
    } as any;
}

console.log('✅ DOM Polyfills applied');
