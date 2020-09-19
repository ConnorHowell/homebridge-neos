import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME, CLIENT_ID, CLIENT_SECRET } from './settings';
import { contactSensorAccessory } from './contactSensorAccessory';
import { NeosDeviceType, NeosDevice, NeosAPI } from './NeosAPI';
import { AuthenticationError } from './errors';

/**
 * NeosHomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class NeosHomebridgePlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    public readonly neosAPI!: NeosAPI;

    // this is used to track restored cached accessories
    public readonly accessories: PlatformAccessory[] = [];

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API,
    ) {
        if (!config || !config.options) {
            this.log.info('No options found in configuration file, disabling plugin.');
            return;
        }
        const options = config.options;

        if (options.username === undefined || options.password === undefined) {
            this.log.error('Missing required config parameter.');
            return;
        }

        this.neosAPI = new NeosAPI(
            options.username,
            options.password,
            CLIENT_ID,
            CLIENT_SECRET,
            this.log
        )

        this.api.on('didFinishLaunching', async () => {
            log.debug('Executed didFinishLaunching callback');
            try {
                await this.neosAPI.getOrRefreshToken();
                await this.discoverDevices();

            } catch (e) {
                if (e instanceof AuthenticationError) {
                    this.log.error('Authentication error: %s', e.message);
                } else {
                    this.log.error(e.message);
                    this.log.debug(e);
                }
            }
        });
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }

    /**
     * This is an example method showing how to register discovered accessories.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     */
    async discoverDevices() {
        let devices = await this.neosAPI.discoverDevices() || [];

        // loop over the discovered devices and register each one if it has not already been registered
        for (const device of devices) {

            const uuid = this.api.hap.uuid.generate(device.id);

            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

            if (existingAccessory) {
                // the accessory already exists
                this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

                new contactSensorAccessory(this, existingAccessory);

            } else {
                this.log.info('Adding new accessory:', device.name);

                const accessory = new this.api.platformAccessory(device.name, uuid);

                accessory.context.device = device;

                new contactSensorAccessory(this, accessory);

                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
        }

    }
}
