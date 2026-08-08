import { GenerationJob, GenerationJobSchema } from "@demo-site-generator/shared";

const jobs = new Map<string, GenerationJob>();

export function createJob(businessId: string): GenerationJob {
  const job: GenerationJob = {
    id: crypto.randomUUID(),
    businessId,
    status: "pending",
    progress: 0,
    currentStep: "queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): GenerationJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<GenerationJob>): GenerationJob {
  const existing = jobs.get(id);
  if (!existing) throw new Error(`Job ${id} not found`);
  const updated = GenerationJobSchema.parse({
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  jobs.set(id, updated);
  return updated;
}

export function listJobs() {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function deleteJob(id: string) {
  jobs.delete(id);
}
