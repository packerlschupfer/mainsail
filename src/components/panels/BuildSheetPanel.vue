<template>
    <panel
        v-if="klipperReadyForGui"
        :icon="mdiLayersTriple"
        :title="$t('Panels.BuildSheetPanel.Headline')"
        :collapsible="true"
        card-class="build-sheet-panel">
        <v-card-text>
            <div class="mb-1">
                <v-btn
                    v-for="name in available"
                    :key="name"
                    :color="name === active ? 'primary' : ''"
                    :outlined="name !== active"
                    small
                    class="mr-2 mb-2"
                    @click="selectSheet(name)">
                    {{ name }}
                    <span class="ml-2 caption" :class="{ 'text--secondary': name !== active }">
                        {{ formatOffset(offsets[name]) }}
                    </span>
                </v-btn>
            </div>
            <v-divider class="my-2" />
            <div class="d-flex align-center">
                <div class="flex-grow-1">
                    <span class="text--secondary">{{ $t('Panels.BuildSheetPanel.Active') }}:</span>
                    <strong class="ml-1">{{ active || '—' }}</strong>
                    <span class="text--secondary ml-3">{{ $t('Panels.BuildSheetPanel.Offset') }}:</span>
                    <strong class="ml-1">{{ formatOffset(offset) }}</strong>
                </div>
                <v-btn small text :disabled="!active" :loading="loadings.includes('buildSheetSaveZ')" @click="saveZ">
                    <v-icon small class="mr-1">{{ mdiContentSaveOutline }}</v-icon>
                    {{ $t('Panels.BuildSheetPanel.SaveZ') }}
                </v-btn>
            </div>
        </v-card-text>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { mdiLayersTriple, mdiContentSaveOutline } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class BuildSheetPanel extends Mixins(BaseMixin) {
    mdiLayersTriple = mdiLayersTriple
    mdiContentSaveOutline = mdiContentSaveOutline

    // status from the [sheets] klipper extra (FW-owned). data-driven: survives sheet renames.
    get sheets() {
        return this.$store.state.printer?.sheets ?? {}
    }

    get available(): string[] {
        return this.sheets.available ?? []
    }

    get active(): string {
        return this.sheets.active ?? ''
    }

    get offset(): number {
        return this.sheets.offset ?? 0
    }

    get offsets(): { [key: string]: number } {
        return this.sheets.offsets ?? {}
    }

    formatOffset(value: number | undefined | null): string {
        if (value === undefined || value === null) return ''
        return `${value >= 0 ? '+' : ''}${value.toFixed(3)} mm`
    }

    selectSheet(name: string): void {
        if (name === this.active) return
        const gcode = `SET_SHEET NAME=${name}`
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode })
    }

    saveZ(): void {
        const gcode = 'SHEET_SAVE_Z'
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode }, { loading: 'buildSheetSaveZ' })
    }
}
</script>
