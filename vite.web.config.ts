import { cp, rm } from 'node:fs/promises'
import { dirname, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath, loadEnv, type Plugin } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { ruffleSafari14 } from './scripts/ruffle-vite'
import { appVersion } from './scripts/app-version'
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    const outputDirEnv = env.VITE_OUTPUT_DIR
    const projectRoot = dirname(fileURLToPath(import.meta.url))
    const outDir = resolve(outputDirEnv) || resolve(projectRoot, 'out')
    const petSourceDir = resolve(projectRoot, 'resources/pet')
    const petOutDir = resolve(outDir, 'pet')

    function copyPetResources(): Plugin {
        return {
            name: 'copy-pet-resources',
            apply: 'build',
            async writeBundle() {
                await rm(petOutDir, { recursive: true, force: true })
                await cp(petSourceDir, petOutDir, { recursive: true })
            },
        }
    }

    function relativePetRoot(fileName: string): string {
        const relativePath = posix.relative(posix.dirname(fileName), 'pet')
        return `${relativePath || '.'}/`
    }

    function rewritePetUrls(source: string, petRoot: string): string {
        return source.replace(/(^|[^.:])\/pet\//g, (_, prefix: string) => `${prefix}${petRoot}`)
    }

    function rewriteWebPetUrls(): Plugin {
        return {
            name: 'rewrite-web-pet-urls',
            apply: 'build',
            enforce: 'post',
            generateBundle(_, bundle) {
                for (const [fileName, asset] of Object.entries(bundle)) {
                    const petRoot = relativePetRoot(fileName)

                    if (asset.type === 'chunk') {
                        asset.code = rewritePetUrls(asset.code, petRoot)
                        continue
                    }

                    if (typeof asset.source === 'string') {
                        asset.source = rewritePetUrls(asset.source, petRoot)
                    }
                }
            },
        }
    }

    return {
        root: resolve(projectRoot, 'src/renderer'),
        base: './',
        publicDir: false,
        build: {
            target: 'safari14',
            cssTarget: 'safari14',
            outDir,
            emptyOutDir: true,
            rollupOptions: {
                input: {
                    index: resolve(projectRoot, 'src/renderer/index.html'),
                    game: resolve(projectRoot, 'src/renderer/game.html'),
                    swf: resolve(projectRoot, 'src/renderer/swf.html'),
                },
            },
        },
        plugins: [
            appVersion(),
            ruffleSafari14(),
            {
                name: 'web-bridge',
                transformIndexHtml: {
                    order: 'pre',
                    handler(html, ctx) {
                        if (!ctx.filename.endsWith('index.html')) return html
                        return html.replace(
                            '<script type="module" src="./bootstrap.ts">',
                            '<script type="module" src="../web/bridge.ts"></script>\n    <script type="module" src="./bootstrap.ts">',
                        )
                    },
                },
            },
            viteStaticCopy({
                targets: [
                    {
                        src: `${normalizePath(resolve(projectRoot, 'node_modules/@ruffle-rs/ruffle'))}/*`,
                        dest: 'ruffle',
                        rename: { stripBase: true },
                    },
                ],
            }),
            rewriteWebPetUrls(),
            copyPetResources(),
        ],
    }
})
