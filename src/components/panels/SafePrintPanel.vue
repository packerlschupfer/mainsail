<template>
    <panel
        v-if="klipperReadyForGui"
        :icon="mdiShieldCheckOutline"
        :title="$t('Panels.SafePrintPanel.Headline')"
        :collapsible="true"
        card-class="safe-print-panel">
        <v-card-text>
            <div class="d-flex align-center">
                <div class="flex-grow-1">
                    <div class="d-flex align-center">
                        <strong>{{ $t('Panels.SafePrintPanel.SafeMode') }}</strong>
                        <v-chip x-small label class="ml-2" :color="enabled ? 'primary' : ''">
                            {{ enabled ? $t('Panels.SafePrintPanel.On') : $t('Panels.SafePrintPanel.Off') }}
                        </v-chip>
                    </div>
                    <span class="text--secondary caption">
                        {{ enabled ? $t('Panels.SafePrintPanel.HintOn') : $t('Panels.SafePrintPanel.HintOff') }}
                    </span>
                </div>
                <v-switch
                    :input-value="enabled"
                    :loading="loadings.includes('safePrintMode')"
                    :disabled="loadings.includes('safePrintMode')"
                    hide-details
                    class="mt-0"
                    inset
                    @change="setMode" />
            </div>
        </v-card-text>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { mdiShieldCheckOutline } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class SafePrintPanel extends Mixins(BaseMixin) {
    mdiShieldCheckOutline = mdiShieldCheckOutline

    // FW-owned persistent toggle (save_variables). PRINT_START honors it:
    // 1 => forces PHASE_STEP=0 OFFBED=0 (step/dir + crash-detect + on-bed prime).
    get enabled(): boolean {
        return Number(this.$store.state.printer?.save_variables?.variables?.safe_print_mode ?? 0) === 1
    }

    setMode(value: boolean): void {
        const gcode = `SAFE_PRINT_MODE VALUE=${value ? 1 : 0}`
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode }, { loading: 'safePrintMode' })
    }
}
</script>
