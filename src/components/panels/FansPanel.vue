<template>
    <panel
        v-if="klipperReadyForGui && hasFans"
        :icon="mdiFan"
        :title="$t('Panels.FansPanel.Headline')"
        :collapsible="true"
        card-class="fans-panel">
        <!-- standard fans (part / generic / heater / controller) reuse the misc fan control -->
        <div v-for="(object, index) of fans" :key="'fan_' + index">
            <v-divider v-if="index" />
            <miscellaneous-slider
                :name="object.name"
                :type="object.type"
                :target="object.power"
                :rpm="object.rpm"
                :controllable="object.controllable"
                :pwm="object.pwm"
                :off_below="object.off_below"
                :max="object.max_power"
                :multi="parseInt(object.scale)" />
        </div>

        <!-- temperature_fans: read-only live speed/rpm, plus cap sliders for the chamber fan -->
        <template v-for="(tf, tindex) of temperatureFans">
            <v-divider v-if="fans.length || tindex" :key="'tfd_' + tindex" />
            <v-container :key="'tf_' + tindex" class="px-0 py-2">
                <v-subheader class="_fan-subheader">
                    <v-icon small class="mr-2">{{ mdiFan }}</v-icon>
                    <span>{{ formatName(tf.name) }}</span>
                    <v-spacer />
                    <small v-if="tf.rpm !== null && tf.rpm !== undefined" class="mr-2">
                        {{ Math.round(tf.rpm) }} RPM
                    </small>
                    <span class="font-weight-bold">{{ Math.round(tf.speed * 100) }} %</span>
                </v-subheader>

                <template v-if="tf.name === 'ext_chamber' && chamberMaxspeed !== null">
                    <v-card-text class="py-1">
                        <div class="d-flex align-center">
                            <span class="caption text--secondary flex-grow-1">{{ $t('Panels.FansPanel.MaxCap') }}</span>
                            <span class="font-weight-bold">{{ Math.round(chamberMaxspeed * 100) }} %</span>
                        </div>
                        <v-slider
                            :value="chamberMaxspeed"
                            :min="chamberMinspeed ?? 0"
                            :max="1"
                            :step="0.01"
                            hide-details
                            @change="setMax">
                            <template #prepend>
                                <v-icon @click="setMax(round2(chamberMaxspeed - 0.05))">{{ mdiMinus }}</v-icon>
                            </template>
                            <template #append>
                                <v-icon @click="setMax(round2(chamberMaxspeed + 0.05))">{{ mdiPlus }}</v-icon>
                            </template>
                        </v-slider>
                    </v-card-text>

                    <v-card-text v-if="chamberMinspeed !== undefined" class="py-1">
                        <div class="d-flex align-center">
                            <span class="caption text--secondary flex-grow-1">{{ $t('Panels.FansPanel.MinCap') }}</span>
                            <span class="font-weight-bold">{{ Math.round(chamberMinspeed * 100) }} %</span>
                        </div>
                        <v-slider
                            :value="chamberMinspeed"
                            :min="0"
                            :max="chamberMaxspeed"
                            :step="0.01"
                            hide-details
                            @change="setMin">
                            <template #prepend>
                                <v-icon @click="setMin(round2(chamberMinspeed - 0.05))">{{ mdiMinus }}</v-icon>
                            </template>
                            <template #append>
                                <v-icon @click="setMin(round2(chamberMinspeed + 0.05))">{{ mdiPlus }}</v-icon>
                            </template>
                        </v-slider>
                    </v-card-text>
                </template>
            </v-container>
        </template>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import MiscellaneousSlider from '@/components/inputs/MiscellaneousSlider.vue'
import { mdiFan, mdiMinus, mdiPlus } from '@mdi/js'

interface FanObject {
    name: string
    type: string
    power: number
    rpm: number | null
    controllable: boolean
    pwm: boolean
    off_below?: number
    max_power?: number
    scale: number
}

interface TemperatureFanRow {
    name: string
    speed: number
    rpm: number | null
}

@Component({
    components: { Panel, MiscellaneousSlider },
})
export default class FansPanel extends Mixins(BaseMixin) {
    mdiFan = mdiFan
    mdiMinus = mdiMinus
    mdiPlus = mdiPlus

    get fans(): FanObject[] {
        const fanTypes = ['fan', 'fan_generic', 'heater_fan', 'controller_fan']
        return (this.$store.getters['printer/getMiscellaneous'] ?? []).filter((o: FanObject) =>
            fanTypes.includes(o.type)
        )
    }

    get temperatureFans(): TemperatureFanRow[] {
        const out: TemperatureFanRow[] = []
        const printer = (this.$store.state.printer ?? {}) as {
            [key: string]: { speed?: number; rpm?: number | null }
        }
        Object.keys(printer).forEach((key) => {
            if (!key.startsWith('temperature_fan ')) return
            const name = key.slice('temperature_fan '.length)
            if (name.startsWith('_')) return
            const v = printer[key] ?? {}
            out.push({ name, speed: v.speed ?? 0, rpm: v.rpm ?? null })
        })
        return out.sort((a, b) => a.name.localeCompare(b.name))
    }

    // CHAMBER_FAN macro vars are the only readable source of truth for the cap (FW-owned).
    get chamber(): { maxspeed?: number; minspeed?: number } | undefined {
        const printer = (this.$store.state.printer ?? {}) as {
            [key: string]: { maxspeed?: number; minspeed?: number }
        }
        return printer['gcode_macro CHAMBER_FAN']
    }

    get chamberMaxspeed(): number | null {
        const m = this.chamber
        return m && m.maxspeed !== undefined ? m.maxspeed : null
    }

    // undefined until FW's MIN lever is deployed -> the min slider stays hidden until then.
    get chamberMinspeed(): number | undefined {
        const m = this.chamber
        return m && m.minspeed !== undefined ? m.minspeed : undefined
    }

    get hasFans() {
        return this.fans.length > 0 || this.temperatureFans.length > 0
    }

    round2(v: number): number {
        return Math.min(1, Math.max(0, Math.round(v * 100) / 100))
    }

    formatName(name: string): string {
        return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }

    setMax(value: number): void {
        let v = this.round2(value)
        const min = this.chamberMinspeed ?? 0
        if (v < min) v = min // klipper rejects min > max
        this.sendChamber(`CHAMBER_FAN MAX=${v}`)
    }

    setMin(value: number): void {
        let v = this.round2(value)
        const max = this.chamberMaxspeed ?? 1
        if (v > max) v = max // klipper rejects min > max
        this.sendChamber(`CHAMBER_FAN MIN=${v}`)
    }

    sendChamber(gcode: string): void {
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode })
    }
}
</script>
