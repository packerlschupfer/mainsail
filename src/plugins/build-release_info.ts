import fs from 'fs'
import path from 'path'
import { version } from '../../package.json'
import { PluginOption } from 'vite'

/**
 * Custom build plugin to write the version in a dedicated release_info.json file after bundling
 */

export default function buildReleaseInfo(): PluginOption {
    return {
        name: 'build-release_info',
        writeBundle: () => {
            setImmediate(async () => {
                const versionIdentifier = version.toString()
                const releaseInfoFile = await fs.promises.open(
                    path.resolve(__dirname, '../../dist/release_info.json'),
                    'w'
                )
                await releaseInfoFile.writeFile(
                    JSON.stringify({
                        project_name: 'mainsail',
                        // fork build: Moonraker's web updater treats project_owner as authoritative
                        // and overrides the configured `repo:`, so this MUST be the fork owner.
                        project_owner: 'packerlschupfer',
                        version: `v${versionIdentifier}`,
                    })
                )
                await releaseInfoFile.close()
            })
        },
    }
}
