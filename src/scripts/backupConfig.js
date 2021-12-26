const path = require('path');

/* 
 *  backup config
 */

const backupConfig = {
  BACKUP_DIR: '/backups',
  COLLECTIONS: [
    'images',
    'cameras',
    'models',
    'views'
  ]
};

module.exports = {
  backupConfig,
}