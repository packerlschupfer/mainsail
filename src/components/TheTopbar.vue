<template>
    <div>
        <v-app-bar app elevate-on-scroll :height="topbarHeight" class="topbar pa-0" clipped-left>
            <v-app-bar-nav-icon tile @click.stop="naviDrawer = !naviDrawer" />
            <router-link to="/">
                <inline-svg v-if="sidebarLogo && isSvgLogo" :src="sidebarLogo" :class="logoClasses" />
                <img v-else-if="sidebarLogo" :src="sidebarLogo" :class="logoClasses" alt="Logo" />
                <mainsail-logo v-else :color="logoColor" :class="logoClasses" router to="/" :ripple="false" />
            </router-link>
            <v-toolbar-title class="text-no-wrap ml-0 pl-2 mr-2">{{ printerName }}</v-toolbar-title>
            <printer-selector v-if="countPrinters" />
            <v-spacer />
            <input
                ref="fileUploadAndStart"
                type="file"
                :accept="gcodeInputFileAccept.join(', ')"
                style="display: none"
                @change="uploadAndStart" />
            <v-btn
                v-if="showSaveConfigButton"
                tile
                :icon="$vuetify.breakpoint.smAndDown"
                :text="$vuetify.breakpoint.mdAndUp"
                color="primary"
                class="button-min-width-auto px-3 d-none d-sm-flex save-config-button"
                :disabled="printerIsPrinting"
                :loading="loadings.includes('topbarSaveConfig')"
                @click="saveConfig">
                <v-icon class="d-md-none">{{ mdiContentSave }}</v-icon>
                <span class="d-none d-md-inline">{{ $t('App.TopBar.SAVE_CONFIG') }}</span>
            </v-btn>
            <v-btn
                v-if="boolShowUploadAndPrint"
                tile
                :icon="$vuetify.breakpoint.smAndDown"
                :text="$vuetify.breakpoint.mdAndUp"
                color="primary"
                class="button-min-width-auto px-3 d-none d-sm-flex upload-and-start-button"
                :loading="loadings.includes('btnUploadAndStart')"
                @click="btnUploadAndStart">
                <v-icon class="mr-md-2">{{ mdiFileUpload }}</v-icon>
                <span class="d-none d-md-inline">{{ $t('App.TopBar.UploadPrint') }}</span>
            </v-btn>
            <v-tooltip v-if="safePrintModeActive" bottom>
                <template #activator="{ on, attrs }">
                    <v-chip
                        label
                        color="warning"
                        class="mr-2 font-weight-bold safe-print-badge"
                        v-bind="attrs"
                        v-on="on"
                        @click="goToSafePrintPanel">
                        <v-icon :left="$vuetify.breakpoint.mdAndUp" small>{{ mdiShieldAlertOutline }}</v-icon>
                        <span class="d-none d-md-inline">{{ $t('App.TopBar.SafePrintMode') }}</span>
                    </v-chip>
                </template>
                <span>{{ $t('App.TopBar.SafePrintModeTooltip') }}</span>
            </v-tooltip>
            <v-btn
                v-if="showSoftAbortButton"
                tile
                :icon="$vuetify.breakpoint.smAndDown"
                :text="$vuetify.breakpoint.mdAndUp"
                color="warning"
                class="button-min-width-auto px-3 soft-abort-button"
                :loading="loadings.includes('topbarSoftAbort')"
                @click="softAbort">
                <v-icon class="mr-md-2">{{ mdiStopCircleOutline }}</v-icon>
                <span class="d-none d-md-inline">{{ $t('App.TopBar.SoftAbort') }}</span>
            </v-btn>
            <v-btn
                v-if="klippyIsConnected"
                tile
                :icon="$vuetify.breakpoint.smAndDown"
                :text="$vuetify.breakpoint.mdAndUp"
                color="error"
                class="button-min-width-auto px-3 emergency-button"
                :loading="loadings.includes('topbarEmergencyStop')"
                @click="btnEmergencyStop">
                <v-icon class="mr-md-2">{{ mdiAlertOctagonOutline }}</v-icon>
                <span class="d-none d-md-inline">{{ $t('App.TopBar.EmergencyStop') }}</span>
            </v-btn>
            <the-notification-menu />
            <the-settings-menu />
            <the-top-corner-menu />
        </v-app-bar>
        <v-snackbar v-model="uploadSnackbar.status" :timeout="-1" fixed right bottom>
            <strong>{{ $t('App.TopBar.Uploading') }} {{ uploadSnackbar.filename }}</strong>
            <br />
            {{ Math.round(uploadSnackbar.percent) }} % @ {{ formatFilesize(Math.round(uploadSnackbar.speed)) }}/s
            <br />
            <v-progress-linear class="mt-2" :value="uploadSnackbar.percent"></v-progress-linear>
            <template #action="{ attrs }">
                <v-btn color="red" text v-bind="attrs" style="min-width: auto" @click="cancelUpload">
                    <v-icon class="0">{{ mdiClose }}</v-icon>
                </v-btn>
            </template>
        </v-snackbar>
        <emergency-stop-dialog v-model="showEmergencyStopDialog" />
    </div>
</template>

<script lang="ts">
import { Mixins, Ref } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { validGcodeExtensions } from '@/store/variables'
import Component from 'vue-class-component'
import axios, { AxiosProgressEvent, CancelTokenSource } from 'axios'
import { formatFilesize } from '@/plugins/helpers'
import TheTopCornerMenu from '@/components/TheTopCornerMenu.vue'
import TheSettingsMenu from '@/components/TheSettingsMenu.vue'
import Panel from '@/components/ui/Panel.vue'
import PrinterSelector from '@/components/ui/PrinterSelector.vue'
import MainsailLogo from '@/components/ui/MainsailLogo.vue'
import TheNotificationMenu from '@/components/notifications/TheNotificationMenu.vue'
import { topbarHeight } from '@/store/variables'
import {
    mdiAlertOctagonOutline,
    mdiContentSave,
    mdiFileUpload,
    mdiClose,
    mdiCloseThick,
    mdiShieldAlertOutline,
    mdiStopCircleOutline,
} from '@mdi/js'
import EmergencyStopDialog from '@/components/dialogs/EmergencyStopDialog.vue'
import InlineSvg from 'vue-inline-svg'
import ThemeMixin from '@/components/mixins/theme'

type uploadSnackbar = {
    status: boolean
    filename: string
    percent: number
    speed: number
    total: number
    cancelTokenSource: CancelTokenSource | null
}

@Component({
    components: {
        EmergencyStopDialog,
        InlineSvg,
        Panel,
        TheSettingsMenu,
        TheTopCornerMenu,
        PrinterSelector,
        MainsailLogo,
        TheNotificationMenu,
    },
})
export default class TheTopbar extends Mixins(BaseMixin, ThemeMixin) {
    mdiAlertOctagonOutline = mdiAlertOctagonOutline
    mdiContentSave = mdiContentSave
    mdiFileUpload = mdiFileUpload
    mdiClose = mdiClose
    mdiCloseThick = mdiCloseThick
    mdiShieldAlertOutline = mdiShieldAlertOutline
    mdiStopCircleOutline = mdiStopCircleOutline

    topbarHeight = topbarHeight

    showEmergencyStopDialog = false

    uploadSnackbar: uploadSnackbar = {
        status: false,
        filename: '',
        percent: 0,
        speed: 0,
        total: 0,
        cancelTokenSource: null,
    }

    formatFilesize = formatFilesize

    @Ref() readonly fileUploadAndStart!: HTMLInputElement

    get gcodeInputFileAccept() {
        if (this.isIOS) return []

        return validGcodeExtensions
    }

    get naviDrawer() {
        return this.$store.state.naviDrawer
    }

    set naviDrawer(newVal) {
        this.$store.dispatch('setNaviDrawer', newVal)
    }

    get currentPage() {
        return this.$route.fullPath
    }

    get saveConfigPending() {
        return this.$store.state.printer.configfile?.save_config_pending ?? false
    }

    get hideSaveConfigForBedMash() {
        return this.$store.state.gui.uiSettings.hideSaveConfigForBedMash ?? false
    }

    get showSaveConfigButton() {
        if (!this.klipperReadyForGui) return false
        if (!this.hideSaveConfigForBedMash) return this.saveConfigPending

        let pendingKeys = Object.keys(this.$store.state.printer.configfile?.save_config_pending_items ?? {})
        pendingKeys = pendingKeys.filter((key: string) => !key.startsWith('bed_mesh '))

        return pendingKeys.length > 0
    }

    get printerName(): string {
        if (this.$store.state.gui.general.printername.length) return this.$store.state.gui.general.printername

        return this.$store.state.printer.hostname
    }

    get countPrinters() {
        return this.$store.getters['farm/countPrinters']
    }

    get boolHideUploadAndPrintButton() {
        return this.$store.state.gui.uiSettings.boolHideUploadAndPrintButton ?? false
    }

    get isSvgLogo() {
        return this.sidebarLogo.includes('.svg?timestamp=') || this.sidebarLogo.endsWith('.svg')
    }

    get logoColor(): string {
        return this.$store.state.gui.uiSettings.logo
    }

    get logoClasses() {
        return ['nav-logo', 'ml-2', 'mr-1', 'd-none', 'd-sm-flex']
    }

    get boolShowUploadAndPrint() {
        return (
            this.klippyIsConnected &&
            this.existGcodesRootDirectory &&
            ['standby', 'complete', 'cancelled'].includes(this.printer_state) &&
            !this.boolHideUploadAndPrintButton
        )
    }

    get showSoftAbortButton() {
        // mirror Emergency Stop visibility: always available while klippy is connected.
        // a blocking heat/soak/mesh wait (the thing this interrupts) can occur in standby too
        // (e.g. a manual M190 from the console), so it must not be gated to printing/paused.
        return this.klippyIsConnected
    }

    // Persisted FW flag (save_variables) that silently forces prints onto the legacy step/dir path.
    // Surface it in the always-visible topbar so it can't be missed (the dashboard panel wasn't enough).
    get safePrintModeActive(): boolean {
        return Number(this.$store.state.printer?.save_variables?.variables?.safe_print_mode ?? 0) === 1
    }

    goToSafePrintPanel(): void {
        if (this.$route.path !== '/') this.$router.push('/').catch(() => {})
    }

    get defaultNavigationStateSetting() {
        return this.$store.state.gui?.uiSettings?.defaultNavigationStateSetting ?? 'alwaysOpen'
    }

    mounted() {
        //this.naviDrawer = this.$vuetify.breakpoint.lgAndUp
        switch (this.defaultNavigationStateSetting) {
            case 'alwaysClosed':
                this.naviDrawer = false
                break

            case 'lastState':
                this.naviDrawer = (localStorage.getItem('naviDrawer') ?? 'true') === 'true'
                break

            default:
                this.naviDrawer = this.$vuetify.breakpoint.lgAndUp
        }
    }

    btnEmergencyStop() {
        const confirmOnEmergencyStop = this.$store.state.gui.uiSettings.confirmOnEmergencyStop
        if (confirmOnEmergencyStop) {
            this.showEmergencyStopDialog = true
            return
        }

        this.emergencyStop()
    }

    emergencyStop() {
        this.showEmergencyStopDialog = false
        this.$socket.emit('printer.emergency_stop', {}, { loading: 'topbarEmergencyStop' })
    }

    softAbort() {
        // out-of-band graceful abort: interrupts blocking heat/soak/mesh waits and parks to idle.
        // must NOT be a gcode macro (would queue behind the same wait it is meant to interrupt).
        this.$store.dispatch('server/addEvent', { message: 'machine.soft_abort', type: 'command' })
        this.$socket.emit('machine.soft_abort', {}, { loading: 'topbarSoftAbort' })
    }

    saveConfig() {
        this.$store.dispatch('server/addEvent', { message: 'SAVE_CONFIG', type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: 'SAVE_CONFIG' }, { loading: 'topbarSaveConfig' })
    }

    btnUploadAndStart() {
        this.fileUploadAndStart?.click()
    }

    async uploadAndStart() {
        if (!this.fileUploadAndStart?.files?.length) return

        await this.$store.dispatch('socket/addLoading', { name: 'btnUploadAndStart' })
        const successFiles = []
        for (const file of this.fileUploadAndStart.files) {
            const result = await this.doUploadAndStart(file)
            successFiles.push(result)
        }

        await this.$store.dispatch('socket/removeLoading', { name: 'btnUploadAndStart' })
        for (const file of successFiles) {
            const text = this.$t('App.TopBar.UploadOfFileSuccessful', { file: file }).toString()
            this.$toast.success(text)
        }

        this.fileUploadAndStart.value = ''
        if (this.currentPage !== '/') await this.$router.push('/')
    }

    doUploadAndStart(file: File) {
        const formData = new FormData()
        const filename = file.name

        this.uploadSnackbar.filename = filename
        this.uploadSnackbar.status = true
        this.uploadSnackbar.percent = 0
        this.uploadSnackbar.speed = 0

        formData.append('file', file, filename)
        formData.append('print', 'true')

        return new Promise((resolve) => {
            this.uploadSnackbar.cancelTokenSource = axios.CancelToken.source()
            axios
                .post(this.apiUrl + '/server/files/upload', formData, {
                    cancelToken: this.uploadSnackbar.cancelTokenSource.token,
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                        this.uploadSnackbar.percent = (progressEvent.progress ?? 0) * 100
                        this.uploadSnackbar.speed = progressEvent.rate ?? 0
                        this.uploadSnackbar.total = progressEvent.total ?? 0
                    },
                })
                .then((result) => {
                    this.uploadSnackbar.status = false
                    resolve(result.data.result)
                })
                .catch(() => {
                    this.uploadSnackbar.status = false
                    this.$store.dispatch('socket/removeLoading', { name: 'btnUploadAndStart' })
                    const text = this.$t('App.TopBar.CannotUploadTheFile').toString()
                    this.$toast.error(text)
                })
        })
    }

    cancelUpload(): void {
        this.uploadSnackbar.cancelTokenSource?.cancel()
        this.uploadSnackbar.status = false
    }
}
</script>

<style scoped>
/*noinspection CssUnusedSymbol*/
::v-deep .topbar .v-toolbar__content {
    padding-top: 0 !important;
    padding-bottom: 0 !important;
}

.button-min-width-auto {
    min-width: auto !important;
}
/*noinspection CssUnusedSymbol*/
.topbar .v-btn {
    height: 100% !important;
    max-height: none;
}
::v-deep .topbar .nav-logo {
    width: auto;
    height: 32px;
}
/*noinspection CssUnusedSymbol*/
.topbar .v-btn.v-btn--icon {
    /*noinspection CssUnresolvedCustomProperty*/
    width: var(--topbar-icon-btn-width) !important;
}
/*noinspection CssUnusedSymbol*/
@media (min-width: 768px) {
    header.topbar {
        z-index: 8 !important;
    }
}
</style>
