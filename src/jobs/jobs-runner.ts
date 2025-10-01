import { glob } from "glob"
import { ModuleLoader } from "../hmr/module-loader.js"
import { Cron } from "croner"
import colors from 'yoctocolors';
import path from "path";
import { hashFile } from "../compiler/hash-file.js";

export interface Job {
  schedule: [string] // cron-style schedule strings
  runJob(): Promise<void>
}

interface RegisteredJob {
  file: string
  hash: string
  crons: Cron[]
}

export class JobsRunner {
  private jobsFromFiles = new Map<string, RegisteredJob>()
  private jobsDir: string
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
    this.jobsDir = path.join(baseDir, "src", "jobs")
  }

  async startOrUpdateJobs() {
    const moduleLoader = new ModuleLoader({ absWorkingDir: this.baseDir })
    const jobFiles = await glob(`${this.jobsDir}/**/*job.ts`)
    for (const file of jobFiles) {
      const hash = await hashFile(file)
      const jobName = path.dirname(path.relative(this.jobsDir, file))
      const existingJob = this.jobsFromFiles.get(jobName)
      
      if (existingJob) {
        if (existingJob.hash === hash) {
          // Job file hasn't changed, skip reloading
          //console.log(`Job ${colors.green(jobName)} is up to date, skipping reload.`)
          continue
        }
        // Job file has changed, stop existing jobs
        for (const cronJob of existingJob.crons) {
          //console.log(`Job ${colors.green(jobName)} is being reloaded.`)
          cronJob.stop()
        }
        this.jobsFromFiles.delete(jobName)
      }

      const module: Job = await moduleLoader.loadModule(file)

      const cronerJobs: Cron[] = []
      for (const schedule of module.schedule) {
        console.log(`     ${colors.green("✓")} Scheduling job from ${colors.green(jobName)} with schedule: ${colors.gray(schedule)}`)
        const job = new Cron(schedule, { protect: true }, () => {
          console.log(`     ${colors.green("✓")} 🛎️ Starting job from ${colors.green(jobName)} with schedule: ${colors.gray(schedule)} at ${new Date().toLocaleString()}`)
          try {
            module.runJob()
          } catch (error) {
            console.error(`Error running job ${colors.red(jobName)}:`, error)
          }
        })
        cronerJobs.push(job)
      }
      this.jobsFromFiles.set(jobName, { file: jobName, hash, crons: cronerJobs })
    }
  }

  stop() {
    for (const jobs of this.jobsFromFiles.values()) {
      for (const job of jobs.crons) {
        job.stop()
      }
    }
    this.jobsFromFiles.clear()
  }
}
