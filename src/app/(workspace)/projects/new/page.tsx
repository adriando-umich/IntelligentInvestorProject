import { PageHeader } from "@/components/app/page-header";
import { CreateProjectForm } from "@/components/finance/create-project-form";
import { getServerI18n } from "@/lib/i18n/server";

export default async function NewProjectPage() {
  const { text } = await getServerI18n();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={text.createProject.pageEyebrow}
        title={text.createProject.pageTitle}
        description={text.createProject.pageDescription}
      />
      <CreateProjectForm />
    </div>
  );
}
