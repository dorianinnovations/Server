import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { log } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Comprehensive Application Audit System
 * Checks all core functionality and provides health status
 */
class AppAudit {
  constructor() {
    this.results = {
      database: { status: 'unknown', details: {} },
      routes: { status: 'unknown', details: {} },
      services: { status: 'unknown', details: {} },
      models: { status: 'unknown', details: {} },
      environment: { status: 'unknown', details: {} },
      overall: { status: 'unknown', score: 0 }
    };
  }

  async runFullAudit() {
    log.system('🔍 Starting comprehensive app audit...');
    
    try {
      await this.auditDatabase();
      await this.auditRoutes();
      await this.auditServices();
      await this.auditModels();
      await this.auditEnvironment();
      
      this.calculateOverallHealth();
      
      log.success('✅ App audit completed');
      return this.results;
      
    } catch (error) {
      log.error('❌ App audit failed', error);
      this.results.overall = { status: 'error', score: 0, error: error.message };
      return this.results;
    }
  }

  async auditDatabase() {
    try {
      const dbStatus = mongoose.connection.readyState;
      const dbStates = {
        0: 'disconnected',
        1: 'connected', 
        2: 'connecting',
        3: 'disconnecting'
      };

      if (dbStatus === 1) {
        // Test database operations
        const collections = await mongoose.connection.db.listCollections().toArray();
        
        this.results.database = {
          status: 'healthy',
          details: {
            state: dbStates[dbStatus],
            collections: collections.length,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
          }
        };
      } else {
        this.results.database = {
          status: 'unhealthy',
          details: {
            state: dbStates[dbStatus],
            error: 'Database not connected'
          }
        };
      }
    } catch (error) {
      this.results.database = {
        status: 'error',
        details: { error: error.message }
      };
    }
  }

  async auditRoutes() {
    try {
      const routesPath = path.join(__dirname, '..', 'routes');
      const routeFiles = fs.readdirSync(routesPath).filter(file => file.endsWith('.js'));
      
      const routeDetails = {};
      let workingRoutes = 0;
      
      for (const file of routeFiles) {
        try {
          const routePath = path.join(routesPath, file);
          const stats = fs.statSync(routePath);
          const routeName = file.replace('.js', '');
          
          // Basic validation - check if file is readable and has content
          const content = fs.readFileSync(routePath, 'utf8');
          const hasRouterExport = content.includes('export default') && content.includes('router');
          const hasRouteDefinitions = content.includes('router.get') || content.includes('router.post');
          
          routeDetails[routeName] = {
            exists: true,
            size: stats.size,
            hasExport: hasRouterExport,
            hasRoutes: hasRouteDefinitions,
            lastModified: stats.mtime
          };
          
          if (hasRouterExport && hasRouteDefinitions) {
            workingRoutes++;
          }
          
        } catch (error) {
          routeDetails[file] = {
            exists: false,
            error: error.message
          };
        }
      }
      
      this.results.routes = {
        status: workingRoutes > 0 ? 'healthy' : 'unhealthy',
        details: {
          totalFiles: routeFiles.length,
          workingRoutes,
          routes: routeDetails
        }
      };
      
    } catch (error) {
      this.results.routes = {
        status: 'error',
        details: { error: error.message }
      };
    }
  }

  async auditServices() {
    try {
      const servicesPath = path.join(__dirname, '..', 'services');
      const serviceFiles = fs.readdirSync(servicesPath).filter(file => file.endsWith('.js'));
      
      const serviceDetails = {};
      let workingServices = 0;
      
      for (const file of serviceFiles) {
        try {
          const servicePath = path.join(servicesPath, file);
          const stats = fs.statSync(servicePath);
          const serviceName = file.replace('.js', '');
          
          const content = fs.readFileSync(servicePath, 'utf8');
          const hasExport = content.includes('export default') || content.includes('export ');
          const hasClass = content.includes('class ') || content.includes('function ');
          
          serviceDetails[serviceName] = {
            exists: true,
            size: stats.size,
            hasExport,
            hasClass,
            lastModified: stats.mtime
          };
          
          if (hasExport && hasClass) {
            workingServices++;
          }
          
        } catch (error) {
          serviceDetails[file] = {
            exists: false,
            error: error.message
          };
        }
      }
      
      this.results.services = {
        status: workingServices > 0 ? 'healthy' : 'unhealthy',
        details: {
          totalFiles: serviceFiles.length,
          workingServices,
          services: serviceDetails
        }
      };
      
    } catch (error) {
      this.results.services = {
        status: 'error', 
        details: { error: error.message }
      };
    }
  }

  async auditModels() {
    try {
      const modelsPath = path.join(__dirname, '..', 'models');
      const modelFiles = fs.readdirSync(modelsPath).filter(file => file.endsWith('.js'));
      
      const modelDetails = {};
      let workingModels = 0;
      
      for (const file of modelFiles) {
        try {
          const modelPath = path.join(modelsPath, file);
          const stats = fs.statSync(modelPath);
          const modelName = file.replace('.js', '');
          
          const content = fs.readFileSync(modelPath, 'utf8');
          const hasSchema = content.includes('Schema') && content.includes('mongoose');
          const hasExport = content.includes('export default');
          
          modelDetails[modelName] = {
            exists: true,
            size: stats.size,
            hasSchema,
            hasExport,
            lastModified: stats.mtime
          };
          
          if (hasSchema && hasExport) {
            workingModels++;
          }
          
        } catch (error) {
          modelDetails[file] = {
            exists: false,
            error: error.message
          };
        }
      }
      
      this.results.models = {
        status: workingModels > 0 ? 'healthy' : 'unhealthy',
        details: {
          totalFiles: modelFiles.length,
          workingModels,
          models: modelDetails
        }
      };
      
    } catch (error) {
      this.results.models = {
        status: 'error',
        details: { error: error.message }
      };
    }
  }

  async auditEnvironment() {
    try {
      const requiredEnvVars = [
        'NODE_ENV',
        'PORT',
        'MONGODB_URI',
        'JWT_SECRET'
      ];
      
      const optionalEnvVars = [
        'OPENROUTER_API_KEY',
        'SERPAPI_API_KEY',
        'GOOGLE_SEARCH_API_KEY',
        'REDIS_URL'
      ];
      
      const envStatus = {};
      let requiredCount = 0;
      let optionalCount = 0;
      
      for (const varName of requiredEnvVars) {
        const exists = !!process.env[varName];
        envStatus[varName] = {
          exists,
          required: true,
          value: exists ? '[SET]' : '[MISSING]'
        };
        if (exists) requiredCount++;
      }
      
      for (const varName of optionalEnvVars) {
        const exists = !!process.env[varName];
        envStatus[varName] = {
          exists,
          required: false,
          value: exists ? '[SET]' : '[MISSING]'
        };
        if (exists) optionalCount++;
      }
      
      this.results.environment = {
        status: requiredCount === requiredEnvVars.length ? 'healthy' : 'unhealthy',
        details: {
          requiredVars: requiredCount,
          totalRequired: requiredEnvVars.length,
          optionalVars: optionalCount,
          totalOptional: optionalEnvVars.length,
          variables: envStatus
        }
      };
      
    } catch (error) {
      this.results.environment = {
        status: 'error',
        details: { error: error.message }
      };
    }
  }

  calculateOverallHealth() {
    const components = ['database', 'routes', 'services', 'models', 'environment'];
    let healthyCount = 0;
    let totalComponents = components.length;
    
    for (const component of components) {
      if (this.results[component].status === 'healthy') {
        healthyCount++;
      }
    }
    
    const score = Math.round((healthyCount / totalComponents) * 100);
    let status = 'unhealthy';
    
    if (score >= 90) status = 'excellent';
    else if (score >= 75) status = 'good';
    else if (score >= 50) status = 'fair';
    else status = 'poor';
    
    this.results.overall = {
      status,
      score,
      healthyComponents: healthyCount,
      totalComponents
    };
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        status: this.results.overall.status,
        score: this.results.overall.score,
        components: this.results.overall.healthyComponents + '/' + this.results.overall.totalComponents
      },
      details: this.results
    };
    
    return report;
  }

  getHealthStatus() {
    return {
      healthy: this.results.overall.score >= 75,
      score: this.results.overall.score,
      status: this.results.overall.status
    };
  }
}

export default AppAudit;