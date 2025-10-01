// Environment configuration utility
class EnvironmentConfig {
  constructor() {
    this.isSubdirectoryDeployment = process.env.IS_SUBDIRECTORY_DEPLOYMENT === 'true';
    this.subdirectoryName = process.env.SUBDIRECTORY_NAME || 'pajar';
    this.customUploadPath = process.env.UPLOAD_BASE_PATH;
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Get the correct upload path based on deployment environment
   * @param {string} filename - The uploaded filename
   * @returns {string} - Correct path format
   */
  getUploadPath(filename) {
    // If custom path is set, use it
    if (this.customUploadPath) {
      return `${this.customUploadPath}/${filename}`;
    }

    // If deployed in subdirectory (like /pajar), don't add /pajar prefix
    if (this.isSubdirectoryDeployment) {
      return `/uploads/${filename}`;
    }

    // Default: add subdirectory prefix for local development
    return `/pajar/uploads/${filename}`;
  }

  /**
   * Normalize existing paths from database
   * @param {string} path - Existing path
   * @returns {string} - Normalized path
   */
  normalizePath(path) {
    if (!path) return '';

    // Remove multiple /pajar/pajar/ occurrences
    while (path.includes('/pajar/pajar/')) {
      path = path.replace('/pajar/pajar/', '/pajar/');
    }

    // Remove multiple /uploads/uploads/ occurrences
    while (path.includes('/uploads/uploads/')) {
      path = path.replace('/uploads/uploads/', '/uploads/');
    }

    // For subdirectory deployment, ensure path starts with /uploads/
    if (this.isSubdirectoryDeployment) {
      // Remove /pajar prefix if exists
      if (path.startsWith('/pajar/uploads/')) {
        return path.replace('/pajar/uploads/', '/uploads/');
      }
      
      if (path.startsWith('/pajar/')) {
        return path.replace('/pajar/', '/uploads/');
      }

      if (path.startsWith('/uploads/')) {
        return path;
      }

      if (path.startsWith('uploads/')) {
        return `/${path}`;
      }

      // If it's just a filename
      if (!path.includes('/')) {
        return `/uploads/${path}`;
      }

      return path;
    }

    // For non-subdirectory deployment (local development)
    // Ensure path starts with /pajar/uploads/
    if (path.startsWith('/pajar/uploads/')) {
      return path;
    }

    if (path.startsWith('/uploads/')) {
      return `/pajar${path}`;
    }

    if (path.startsWith('uploads/')) {
      return `/pajar/${path}`;
    }

    if (!path.includes('/')) {
      return `/pajar/uploads/${path}`;
    }

    return path;
  }

  /**
   * Get static serve configuration
   * @returns {object} - Configuration for express.static
   */
  getStaticConfig() {
    if (this.isSubdirectoryDeployment) {
      return {
        route: '/uploads',
        directory: 'uploads'
      };
    }

    return {
      route: '/pajar/uploads',
      directory: 'uploads'
    };
  }

  /**
   * Get API base path
   * @returns {string} - Base path for API routes
   */
  getApiBasePath() {
    if (this.isSubdirectoryDeployment) {
      return '';
    }
    return '/pajar';
  }

  /**
   * Get configuration summary for debugging
   * @returns {object} - Configuration summary
   */
  getConfigSummary() {
    return {
      environment: this.environment,
      isSubdirectoryDeployment: this.isSubdirectoryDeployment,
      subdirectoryName: this.subdirectoryName,
      customUploadPath: this.customUploadPath,
      staticConfig: this.getStaticConfig(),
      apiBasePath: this.getApiBasePath(),
      sampleUploadPath: this.getUploadPath('example.jpg')
    };
  }
}

module.exports = EnvironmentConfig;
