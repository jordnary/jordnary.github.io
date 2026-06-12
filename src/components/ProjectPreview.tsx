import type { ProjectPreview as ProjectPreviewData } from '../data/projects'

export function ProjectPreviewMock({
  variant,
}: {
  variant: ProjectPreviewData['variant']
}) {
  switch (variant) {
    case 'personal':
      return <ProjectPreviewPersonal />
    case 'components':
      return <ProjectPreviewComponents />
    case 'deploy':
      return <ProjectPreviewDeploy />
  }
}

function ProjectPreviewPersonal() {
  return (
    <div
      aria-hidden="true"
      className="project-preview-mock project-preview-personal"
    >
      <div className="mock-browser">
        <div className="mock-browser-bar">
          <span />
          <span />
          <span />
        </div>
        <div className="mock-personal-hero">
          <div className="mock-personal-avatar">J</div>
          <div className="mock-personal-copy">
            <span className="mock-line mock-line-wide" />
            <span className="mock-line mock-line-short" />
          </div>
        </div>
        <div className="mock-personal-tabs">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="mock-floating-console">
        <span>LOG</span>
        <strong>WIP</strong>
      </div>
    </div>
  )
}

function ProjectPreviewComponents() {
  return (
    <div
      aria-hidden="true"
      className="project-preview-mock project-preview-components"
    >
      <div className="mock-component-grid">
        <div className="mock-component-card mock-component-card-main">
          <span />
          <strong />
          <small />
        </div>
        <div className="mock-component-card">
          <span />
          <strong />
        </div>
        <div className="mock-component-card">
          <span />
          <strong />
        </div>
      </div>
      <div className="mock-component-rail">
        <span />
        <span />
        <span />
      </div>
      <div className="mock-code-chip">props</div>
    </div>
  )
}

function ProjectPreviewDeploy() {
  return (
    <div
      aria-hidden="true"
      className="project-preview-mock project-preview-ai-playground"
    >
      <div className="mock-ai-node-field">
        <span className="mock-ai-node mock-ai-node-main" />
        <span className="mock-ai-node mock-ai-node-a" />
        <span className="mock-ai-node mock-ai-node-b" />
        <span className="mock-ai-node mock-ai-node-c" />
        <span className="mock-ai-link mock-ai-link-a" />
        <span className="mock-ai-link mock-ai-link-b" />
        <span className="mock-ai-link mock-ai-link-c" />
      </div>

      <div className="mock-ai-workspace">
        <div className="mock-ai-window-bar">
          <span />
          <span />
          <span />
        </div>
        <div className="mock-ai-prompt-card">
          <span className="mock-ai-chip" />
          <span className="mock-ai-line mock-ai-line-wide" />
          <span className="mock-ai-line mock-ai-line-mid" />
          <span className="mock-ai-line mock-ai-line-short" />
        </div>
        <div className="mock-ai-response-card">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="mock-ai-side-stack">
        <div className="mock-ai-model-card">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="mock-ai-meter-card">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
