import 'fast-text-encoding';
import 'react-native-url-polyfill/auto';

console.log('Polyfills START');

// Polyfill DOM globals for Three.js
// @ts-ignore
if (typeof window === 'undefined') {
    // @ts-ignore
    global.window = global;
}

// Polyfill window.location (CRITICAL for Three.js loaders)
// @ts-ignore
if (typeof window !== 'undefined' && !window.location) {
    // @ts-ignore
    window.location = {
        href: 'http://localhost',
        protocol: 'http:',
        host: 'localhost',
        hostname: 'localhost',
        port: '80',
        pathname: '/',
        search: '',
        hash: '',
        replace: () => { },
        assign: () => { },
        reload: () => { },
        toString: () => 'http://localhost'
    };
}

if (typeof document === 'undefined') {
    // @ts-ignore
    global.document = {
        createElement: (tag: string) => {
            // Return dummy elements with sufficient compatibility
            if (tag === 'img') {
                return {
                    src: '',
                    width: 0,
                    height: 0,
                    style: {},
                    addEventListener: () => { },
                    removeEventListener: () => { },
                } as any;
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
            } as any;
        },
        createElementNS: (_ns: string, tag: string) => {
            return (global.document as any).createElement(tag);
        },
        body: {
            appendChild: (_: any) => _,
            removeChild: (_: any) => _,
        },
        head: {
            appendChild: (_: any) => _,
        },
    };
}

if (typeof navigator === 'undefined') {
    // @ts-ignore
    global.navigator = {
        userAgent: 'ReactNative',
    };
}

console.log('✅ DOM Polyfills applied');
