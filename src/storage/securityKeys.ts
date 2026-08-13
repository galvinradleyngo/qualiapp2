// Key names under which a project's `data` table stores its PIN/recovery
// material. Must match the legacy app's IndexedDB keys exactly — legacy
// backups carry `security.appPinV2` / `security.recoveryV2` blobs that get
// written straight into a new project's `data` table under these same keys.
export const SEC_APP_PIN_KEY = 'sec_app_pin';
export const SEC_PARTICIPANT_PIN_KEY = 'sec_participant_pin';
export const SEC_RECOVERY_KEY = 'sec_recovery';
