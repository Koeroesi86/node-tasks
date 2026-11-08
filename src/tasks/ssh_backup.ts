import {
  backupViaSsh,
  notifyFailure,
  parseKeep,
  parseList,
} from '../handlers/ssh_backup';

(async () => {
  const [host, destination, ...paths] = process.argv.slice(2);

  if (!host || !destination || !paths.length) {
    throw new Error(
      'Usage: node ssh_backup.js "<ssh_config_host>" "<local_dir>" "<remote_path>" ["<remote_path>"...]'
    );
  }

  // Archives can contain keys and certificates: owner-only access.
  process.umask(0o077);

  const archive = await backupViaSsh({
    host,
    destination,
    paths,
    excludes: parseList(process.env.SSH_BACKUP_EXCLUDE),
    keep: parseKeep(process.env.SSH_BACKUP_KEEP),
  }).catch(async (error: unknown) => {
    await notifyFailure(process.env.SSH_BACKUP_ON_FAILURE, host, error);
    throw error;
  });

  console.log(`Backup written to ${archive}`);
})();
