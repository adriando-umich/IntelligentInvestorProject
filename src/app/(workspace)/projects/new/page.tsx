import { PageHeader } from "@/components/app/page-header";
import { CreateProjectForm } from "@/components/finance/create-project-form";

export default function NewProjectPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace setup"
        title="Create a project"
        description="Start a real workspace in Supabase so your team can sign in, add transactions, and track cash, settlements, capital, and profit in one place."
      />
      <CreateProjectForm />
    </div>
  );
}
