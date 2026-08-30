<template>
    <panel
        v-if="klipperReadyForGui"
        :icon="mdiAdjust"
        :title="$t('Panels.FilamentMaterialPanel.Headline')"
        :collapsible="true"
        card-class="filament-material-panel">
        <v-card-text>
            <v-alert v-if="awaitingMaterial" dense text type="warning" class="mb-3 py-2">
                {{ $t('Panels.FilamentMaterialPanel.AwaitingHint') }}
            </v-alert>
            <div class="mb-1">
                <v-btn
                    v-for="name in available"
                    :key="name"
                    :color="name === loaded ? 'primary' : ''"
                    :outlined="name !== loaded"
                    small
                    class="mr-2 mb-2"
                    :loading="loadings.includes('filamentSet' + name)"
                    @click="selectMaterial(name)">
                    {{ name }}
                </v-btn>
            </div>
            <v-divider class="my-2" />
            <div class="d-flex align-center flex-wrap">
                <div class="flex-grow-1">
                    <div class="d-flex align-center">
                        <span class="text--secondary">{{ $t('Panels.FilamentMaterialPanel.Loaded') }}:</span>
                        <strong class="ml-1">{{ loaded || '—' }}</strong>
                        <v-chip v-if="awaitingMaterial" x-small label color="warning" class="ml-2">
                            {{ $t('Panels.FilamentMaterialPanel.Unknown') }}
                        </v-chip>
                    </div>
                    <span v-if="known" class="text--secondary caption">
                        {{ $t('Panels.FilamentMaterialPanel.Nozzle') }} {{ nozzle }}°C ·
                        {{ $t('Panels.FilamentMaterialPanel.Bed') }} {{ bed }}°C
                        <template v-if="isFlexible">· {{ $t('Panels.FilamentMaterialPanel.Flexible') }}</template>
                        <template v-if="abrasive">· {{ $t('Panels.FilamentMaterialPanel.Abrasive') }}</template>
                    </span>
                </div>
                <v-btn small text :disabled="!known" :loading="loadings.includes('filamentClear')" @click="clear">
                    <v-icon small class="mr-1">{{ mdiBackspaceOutline }}</v-icon>
                    {{ $t('Panels.FilamentMaterialPanel.Clear') }}
                </v-btn>
            </div>
            <v-divider class="my-2" />
            <div class="d-flex flex-wrap">
                <v-btn
                    small
                    outlined
                    class="mr-2 mb-2"
                    :disabled="printerIsPrinting"
                    :loading="loadings.includes('filamentLoad')"
                    @click="load">
                    {{ $t('Panels.FilamentMaterialPanel.Load') }}
                </v-btn>
                <v-btn
                    small
                    outlined
                    class="mr-2 mb-2"
                    :disabled="printerIsPrinting"
                    :loading="loadings.includes('filamentUnload')"
                    @click="unload">
                    {{ $t('Panels.FilamentMaterialPanel.Unload') }}
                </v-btn>
                <v-btn
                    small
                    outlined
                    class="mr-2 mb-2"
                    :loading="loadings.includes('filamentM600')"
                    @click="changeFilament">
                    {{ $t('Panels.FilamentMaterialPanel.Change') }}
                </v-btn>
            </div>
            <span class="text--secondary caption">{{ $t('Panels.FilamentMaterialPanel.LoadHint') }}</span>
        </v-card-text>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { mdiAdjust, mdiBackspaceOutline } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class FilamentMaterialPanel extends Mixins(BaseMixin) {
    mdiAdjust = mdiAdjust
    mdiBackspaceOutline = mdiBackspaceOutline

    // status from the [filaments] klipper extra (FW-owned). data-driven off `available`,
    // so the material list follows the FW's preset table and never needs a UI change.
    get filaments() {
        return this.$store.state.printer?.filaments ?? {}
    }

    get available(): string[] {
        return this.filaments.available ?? []
    }

    // `loaded` is per-tool; index it rather than assuming a single extruder, so this
    // keeps working if the FW ever reports more than one tool.
    get loaded(): string {
        const loaded = this.filaments.loaded ?? []
        return loaded[this.activeTool] ?? this.filaments.name ?? ''
    }

    get activeTool(): number {
        return this.filaments.active_tool ?? 0
    }

    get known(): boolean {
        return this.filaments.known === true
    }

    // The FW aborts the next print ONCE when it does not know the material. Surfacing it
    // here (and in the topbar) is the whole point: otherwise it reads as "print won't start".
    get awaitingMaterial(): boolean {
        return this.filaments.awaiting_material === true || this.filaments.known === false
    }

    get nozzle(): number {
        return this.filaments.nozzle ?? 0
    }

    get bed(): number {
        return this.filaments.bed ?? 0
    }

    get isFlexible(): boolean {
        return this.filaments.is_flexible === true
    }

    get abrasive(): boolean {
        return this.filaments.abrasive === true
    }

    sendGcode(gcode: string, loading: string): void {
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode }, { loading })
    }

    selectMaterial(name: string): void {
        if (name === this.loaded && this.known) return
        this.sendGcode(`SET_FILAMENT TYPE=${name}`, 'filamentSet' + name)
    }

    clear(): void {
        this.sendGcode('CLEAR_FILAMENT', 'filamentClear')
    }

    // Always pass TYPE= on load/change: LOAD_FILAMENT commits TYPE before the purge, so the
    // purge runs at the incoming material's numbers (the BFW-9003 fix). Omitting it would
    // purge a material change at the OUTGOING material's rate.
    load(): void {
        const type = this.loaded
        this.sendGcode(type ? `LOAD_FILAMENT TYPE=${type}` : 'LOAD_FILAMENT', 'filamentLoad')
    }

    unload(): void {
        this.sendGcode('UNLOAD_FILAMENT', 'filamentUnload')
    }

    changeFilament(): void {
        const type = this.loaded
        this.sendGcode(type ? `M600 TYPE=${type}` : 'M600', 'filamentM600')
    }
}
</script>
