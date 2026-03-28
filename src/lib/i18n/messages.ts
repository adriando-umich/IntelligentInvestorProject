export const messages = {
  en: {
    app: {
      tagline:
        "Project money, capital, and team settlements explained in plain language.",
      languageLabel: "Language",
      languageHint: "Switch the whole UI between English and Vietnamese.",
      english: "English",
      vietnamese: "Vietnamese",
    },
    common: {
      backToProject: "Back to project",
      backToDashboard: "Back to dashboard",
      backToPlanner: "Back to planner",
      addTransaction: "Add transaction",
      manageTags: "Manage tags",
      openTransactionGuide: "Open transaction guide",
      openSampleWorkspace: "Open sample workspace",
      noReceiver: "No receiver",
      noPayer: "No payer",
      noEmail: "No email",
      noTags: "No tags",
      notSet: "Not set",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      copy: "Copy",
      create: "Create",
      update: "Update",
      rename: "Rename",
      openProject: "Open project",
      allActivity: "All activity",
      businessOnly: "Business only",
      correctionOnly: "Corrections only",
      currentAmount: "Current amount",
      tags: "Tags",
      demoMode: "Demo mode",
      pending: "Pending",
      email: "Email",
      password: "Password",
      displayName: "Display name",
      name: "Name",
      role: "Role",
      status: "Status",
      amount: "Amount",
      action: "Action",
      date: "Date",
      description: "Description",
      member: "Member",
      type: "Type",
      notes: "Notes",
      moneyIn: "Money in",
      moneyOut: "Money out",
      createProject: "Create project",
      creatingProject: "Creating project...",
      signIn: "Sign in",
      signingIn: "Signing in...",
      createAccount: "Create account",
      creatingAccount: "Creating account...",
      joined: "Joined",
      expires: "Expires",
      created: "Created",
    },
    shell: {
      cockpit: "Project finance cockpit",
      projects: "Projects",
      newProject: "New project",
      activeProjects: "Active projects",
      noLiveProjectsYet: "No live projects yet.",
      signedInAs: "Signed in as",
      signOut: "Sign out",
      projectNavigationTitle: "Project navigation",
      projectNavigationDescription:
        "Switch between projects and account actions.",
      defaultViewerName: "Project member",
    },
    nav: {
      overview: "Overview",
      settlements: "Settlements",
      tags: "Tags",
      members: "Members",
      capital: "Capital",
      reconciliation: "Reconciliation",
      advanced: "Advanced view",
    },
    statuses: {
      project: {
        active: "Active",
        archived: "Archived",
        closed: "Closed",
      },
      invite: {
        pending: "Pending",
        accepted: "Accepted",
        revoked: "Revoked",
        expired: "Expired",
      },
      reconciliation: {
        pending: "Pending",
        matched: "Matched",
        variance_found: "Variance found",
        accepted: "Accepted",
        adjustment_posted: "Adjustment posted",
      },
      role: {
        owner: "Owner",
        manager: "Manager",
        member: "Member",
      },
    },
    finance: {
      entryTypes: {
        capital_contribution: "Capital contribution",
        capital_return: "Capital return",
        operating_income: "Operating income",
        shared_loan_drawdown: "Shared loan drawdown",
        shared_loan_repayment_principal: "Shared loan principal repayment",
        land_purchase: "Land purchase",
        shared_loan_interest_payment: "Shared loan interest payment",
        operating_expense: "Operating expense",
        cash_handover: "Cash handover",
        expense_settlement_payment: "Member repayment",
        profit_distribution: "Profit distribution",
        reconciliation_adjustment: "Reconciliation adjustment",
        reversal: "Reversal",
      },
      entryFamilies: {
        business: "Business event",
        correction: "Correction",
      },
      allocationTypes: {
        capital_owner: "Capital owner",
        income_share: "Income share",
        expense_share: "Expense share",
        profit_share: "Profit share",
      },
    },
    signIn: {
      heroEyebrow: "Project finance",
      plainLanguageTitle: "Plain-language money view",
      plainLanguageDescription:
        "Project cash, team debts, capital, and profit stay separated so nobody has to decode accounting terms.",
      settlementTitle: "Shared-expense settlement",
      settlementDescription:
        "The app suggests who should pay whom, Splitwise-style, without mixing that up with profit payouts.",
      capitalTitle: "Capital-based profit logic",
      capitalDescription:
        "Profit weights only follow capital contributions. Operating income and expense still show up clearly, but they do not silently rewrite ownership.",
      accessWorkspaceTitle: "Access the workspace",
      accessWorkspaceLiveDescription:
        "Sign in with your project account, or create one if this is your first time here.",
      accessWorkspaceDemoDescription:
        "This deployment is currently running without live Supabase auth, so the sample workspace is the available path.",
      googleContinue: "Continue with Google",
      googleRedirecting: "Redirecting to Google...",
      googleUnavailable:
        "Google sign-in is not enabled for this workspace yet. Use email below for now.",
      googleSetupMissing:
        "Google sign-in is unavailable until Supabase auth is configured.",
      googleHelper:
        "Use a Google account for a quicker first login. New members can still create a password-based account below if they prefer.",
      continueWithEmail: "Or continue with email",
      signInTab: "Sign in",
      signUpTab: "Create account",
      passwordPlaceholder: "At least 8 characters",
      emailDisabledConfigured:
        "Email sign-in is currently disabled for this workspace.",
      emailDisabledUnconfigured:
        "Live sign-in is disabled until Supabase is configured for this environment.",
      signUpDisabledConfigured:
        "Email account creation is currently disabled for this workspace.",
      signUpDisabledUnconfigured:
        "Account creation will be available once Supabase auth is enabled for this deployment.",
      confirmationRequired:
        "New accounts need email confirmation before the first live sign-in.",
      demoCardTitle: "Need a quick walkthrough first?",
      demoCardDescription:
        "Open the sample workspace to explore the dashboard, member statements, settlements, and reconciliation screens before entering live data.",
    },
    projectsPage: {
      eyebrow: "Workspace",
      title: "Projects",
      description:
        "Open any project to see where project money sits, who owes whom for shared expenses, and what profit could be distributed today.",
      trackedCashTitle: "Tracked project cash",
      trackedCashDescription:
        "Combined project cash custody across the projects you can access.",
      estimatedProfitTitle: "Estimated profit available",
      estimatedProfitDescription:
        "This is undistributed operating profit, not yet paid out.",
      openSettlementTitle: "Open settlement actions",
      openSettlementDescription:
        "Shared-expense transfers the team may still need to record.",
      readyEyebrow: "Ready for live data",
      emptyTitle: "No projects yet",
      emptyDescription:
        "Create your first project to start recording capital, customer income, operating expenses, cash handovers, and settlement payments in the live database.",
      createFirstProject: "Create the first project",
      varianceFound: "Variance found",
      healthyReconciliation: "Healthy reconciliation",
      moneyInProjectNow: "Money in the project now",
      estimatedProfitToday: "Estimated profit today",
      memberCount: (count: number) => `${count} members`,
      settlementSuggestionCount: (count: number) =>
        `${count} settlement suggestions`,
    },
    createProject: {
      pageEyebrow: "Workspace setup",
      pageTitle: "Create a project",
      pageDescription:
        "Start a real workspace in Supabase so your team can sign in, add transactions, and track cash, settlements, capital, and profit in one place.",
      liveOnboarding: "Live onboarding",
      heroTitle: "Create your first live project",
      heroDescription:
        "This sets up a real project in Supabase and adds you as the owner, so you can start recording transactions immediately.",
      whatGetsCreated: "What gets created",
      whatGetsCreatedDescription:
        "A project record, a unique project slug, and your owner membership in the project.",
      whatNext: "What you can do next",
      whatNextDescription:
        "Add capital, customer income, operating expenses, cash handovers, and settlement payments from the project dashboard.",
      detailsTitle: "Project details",
      detailsDescription:
        "Start with the basics. You can add more members after the project exists.",
      summary: "Project summary",
      summaryPlaceholder:
        "Example: Members use their own bank accounts, and this workspace only tracks the project's money.",
    },
    projectPage: {
      eyebrow: "Project dashboard",
      fallbackDescription:
        "Project money, shared expenses, capital, and profit explained in plain language.",
    },
    notFound: {
      eyebrow: "Not found",
      title: "This page does not exist",
      description:
        "The project or member link may be outdated. Return to the workspace to choose an active project.",
      cta: "Go to projects",
    },
    actions: {
      auth: {
        invalidEmail: "Use a valid email address.",
        invalidPassword: "Password must be at least 8 characters.",
        invalidDisplayName:
          "Add the name people should see in the workspace.",
        signInFailed: "Unable to sign in.",
        signUpFailed: "Unable to create account.",
        supabaseMissing: "Supabase is not configured.",
        demoSignUpUnavailable:
          "Live account creation is unavailable because Supabase is not configured.",
        emailVerificationNotice:
          "Account created. Check your email for a confirmation link if your Supabase project requires email verification.",
      },
      projects: {
        projectNameMin: "Project name should be at least 3 characters.",
        currencyInvalid: "Choose a valid 3-letter currency code.",
        demoBlocked:
          "Project creation is disabled in the sample workspace. Sign in with a live account to create a real project.",
        createFailed: "Unable to create project.",
        signInRequired: "You must be signed in before creating a project.",
        missingMigration:
          "The database is missing the latest project-creation migration. Apply the newest SQL migration in Supabase, then try again.",
        invalidResponse:
          "Project was created, but the response payload was invalid.",
      },
    },
  },
  vi: {
    app: {
      tagline:
        "Giải thích tiền dự án, vốn góp và các khoản thanh toán giữa thành viên theo cách dễ hiểu.",
      languageLabel: "Ngôn ngữ",
      languageHint: "Đổi toàn bộ giao diện giữa tiếng Anh và tiếng Việt.",
      english: "English",
      vietnamese: "Tiếng Việt",
    },
    common: {
      backToProject: "Quay lại dự án",
      backToDashboard: "Về dashboard",
      backToPlanner: "Quay lại form giao dịch",
      addTransaction: "Thêm giao dịch",
      manageTags: "Quản lý tag",
      openTransactionGuide: "Mở hướng dẫn giao dịch",
      openSampleWorkspace: "Mở workspace mẫu",
      noReceiver: "Chưa có người nhận",
      noPayer: "Chưa có người chi",
      noEmail: "Chưa có email",
      noTags: "Chưa có tag",
      notSet: "Chưa chọn",
      save: "Lưu",
      cancel: "Hủy",
      delete: "Xóa",
      copy: "Sao chép",
      create: "Tạo",
      update: "Cập nhật",
      rename: "Đổi tên",
      openProject: "Mở dự án",
      allActivity: "Tất cả hoạt động",
      businessOnly: "Chỉ nghiệp vụ thật",
      correctionOnly: "Chỉ điều chỉnh",
      currentAmount: "Số tiền hiện tại",
      tags: "Tag",
      demoMode: "Chế độ demo",
      pending: "Đang chờ",
      email: "Email",
      password: "Mật khẩu",
      displayName: "Tên hiển thị",
      name: "Tên",
      role: "Vai trò",
      status: "Trạng thái",
      amount: "Số tiền",
      action: "Thao tác",
      date: "Ngày",
      description: "Mô tả",
      member: "Thành viên",
      type: "Loại",
      notes: "Ghi chú",
      moneyIn: "Tiền vào",
      moneyOut: "Tiền ra",
      createProject: "Tạo dự án",
      creatingProject: "Đang tạo dự án...",
      signIn: "Đăng nhập",
      signingIn: "Đang đăng nhập...",
      createAccount: "Tạo tài khoản",
      creatingAccount: "Đang tạo tài khoản...",
      joined: "Ngày tham gia",
      expires: "Hết hạn",
      created: "Ngày tạo",
    },
    shell: {
      cockpit: "Bảng điều phối tài chính dự án",
      projects: "Dự án",
      newProject: "Tạo dự án",
      activeProjects: "Dự án đang hoạt động",
      noLiveProjectsYet: "Chưa có dự án live nào.",
      signedInAs: "Đang đăng nhập bằng",
      signOut: "Đăng xuất",
      projectNavigationTitle: "Điều hướng dự án",
      projectNavigationDescription:
        "Chuyển giữa các dự án và thao tác tài khoản.",
      defaultViewerName: "Thành viên dự án",
    },
    nav: {
      overview: "Tổng quan",
      settlements: "Đối trừ",
      tags: "Tag",
      members: "Thành viên",
      capital: "Vốn",
      reconciliation: "Đối chiếu",
      advanced: "Chi tiết kỹ thuật",
    },
    statuses: {
      project: {
        active: "Đang hoạt động",
        archived: "Lưu trữ",
        closed: "Đã đóng",
      },
      invite: {
        pending: "Đang chờ",
        accepted: "Đã chấp nhận",
        revoked: "Đã thu hồi",
        expired: "Đã hết hạn",
      },
      reconciliation: {
        pending: "Đang chờ",
        matched: "Khớp",
        variance_found: "Có chênh lệch",
        accepted: "Đã chấp nhận",
        adjustment_posted: "Đã ghi điều chỉnh",
      },
      role: {
        owner: "Chủ dự án",
        manager: "Quản lý",
        member: "Thành viên",
      },
    },
    finance: {
      entryTypes: {
        capital_contribution: "Góp vốn",
        capital_return: "Hoàn vốn",
        operating_income: "Tiền vào vận hành",
        shared_loan_drawdown: "Giải ngân khoản vay chung",
        shared_loan_repayment_principal: "Trả gốc khoản vay chung",
        land_purchase: "Mua đất",
        shared_loan_interest_payment: "Trả lãi khoản vay chung",
        operating_expense: "Chi phí vận hành",
        cash_handover: "Chuyển tiền giữa thành viên",
        expense_settlement_payment: "Thành viên trả lại tiền cho nhau",
        profit_distribution: "Chia lợi nhuận",
        reconciliation_adjustment: "Điều chỉnh sau đối chiếu",
        reversal: "Bút toán đảo ngược",
      },
      entryFamilies: {
        business: "Nghiệp vụ thật",
        correction: "Điều chỉnh sổ",
      },
      allocationTypes: {
        capital_owner: "Người sở hữu phần vốn",
        income_share: "Phần chia tiền vào",
        expense_share: "Phần chia chi phí",
        profit_share: "Phần chia lợi nhuận",
      },
    },
    signIn: {
      heroEyebrow: "Tài chính dự án",
      plainLanguageTitle: "Nhìn tiền theo cách dễ hiểu",
      plainLanguageDescription:
        "Tiền của dự án, tiền thành viên nợ nhau, vốn góp và lợi nhuận luôn được tách riêng để ai cũng dễ theo dõi.",
      settlementTitle: "Đối trừ chi phí chung",
      settlementDescription:
        "Hệ thống gợi ý ai nên trả ai theo kiểu Splitwise nhưng không nhầm lẫn với chia lợi nhuận.",
      capitalTitle: "Logic lợi nhuận theo vốn góp",
      capitalDescription:
        "Tỷ lệ lợi nhuận chỉ thay đổi theo vốn góp. Thu chi vận hành vẫn hiển thị rõ, nhưng không tự động làm đổi tỷ lệ sở hữu.",
      accessWorkspaceTitle: "Vào workspace",
      accessWorkspaceLiveDescription:
        "Đăng nhập bằng tài khoản dự án của bạn, hoặc tạo tài khoản mới nếu đây là lần đầu sử dụng.",
      accessWorkspaceDemoDescription:
        "Bản deploy này hiện chưa dùng auth live của Supabase, nên lúc này bạn chỉ có thể vào workspace mẫu.",
      googleContinue: "Tiếp tục với Google",
      googleRedirecting: "Đang chuyển sang Google...",
      googleUnavailable:
        "Workspace này chưa bật đăng nhập Google. Tạm thời hãy dùng email ở bên dưới.",
      googleSetupMissing:
        "Chưa thể dùng Google vì môi trường này chưa cấu hình auth Supabase hoàn chỉnh.",
      googleHelper:
        "Đăng nhập bằng Google để vào nhanh hơn. Nếu muốn, thành viên mới vẫn có thể tạo tài khoản bằng email và mật khẩu ở bên dưới.",
      continueWithEmail: "Hoặc tiếp tục bằng email",
      signInTab: "Đăng nhập",
      signUpTab: "Tạo tài khoản",
      passwordPlaceholder: "Ít nhất 8 ký tự",
      emailDisabledConfigured:
        "Workspace này hiện đang tắt đăng nhập bằng email.",
      emailDisabledUnconfigured:
        "Đăng nhập live sẽ có sau khi môi trường này cấu hình Supabase xong.",
      signUpDisabledConfigured:
        "Workspace này hiện đang tắt tạo tài khoản bằng email.",
      signUpDisabledUnconfigured:
        "Tính năng tạo tài khoản sẽ có sau khi auth Supabase được bật cho bản deploy này.",
      confirmationRequired:
        "Tài khoản mới cần xác nhận email trước khi đăng nhập live lần đầu.",
      demoCardTitle: "Muốn xem thử trước?",
      demoCardDescription:
        "Mở workspace mẫu để xem dashboard, statement của từng thành viên, màn đối trừ và màn đối chiếu trước khi nhập dữ liệu thật.",
    },
    projectsPage: {
      eyebrow: "Workspace",
      title: "Dự án",
      description:
        "Mở từng dự án để xem tiền dự án đang nằm ở đâu, ai đang nợ ai do chi phí chung, và hôm nay có thể chia bao nhiêu lợi nhuận.",
      trackedCashTitle: "Tổng tiền dự án đang theo dõi",
      trackedCashDescription:
        "Tổng số tiền dự án đang được giữ trong các dự án mà bạn có quyền xem.",
      estimatedProfitTitle: "Lợi nhuận ước tính có thể chia",
      estimatedProfitDescription:
        "Đây là lợi nhuận vận hành chưa chia, chưa phải số tiền đã thực trả.",
      openSettlementTitle: "Số việc đối trừ còn mở",
      openSettlementDescription:
        "Các khoản trả qua lại vì chi phí chung mà team có thể vẫn chưa ghi nhận.",
      readyEyebrow: "Sẵn sàng nhập dữ liệu thật",
      emptyTitle: "Chưa có dự án nào",
      emptyDescription:
        "Tạo dự án đầu tiên để bắt đầu ghi vốn góp, tiền khách hàng, chi phí vận hành, chuyển tiền nội bộ và các khoản hoàn trả lên database live.",
      createFirstProject: "Tạo dự án đầu tiên",
      varianceFound: "Có chênh lệch",
      healthyReconciliation: "Đối chiếu ổn",
      moneyInProjectNow: "Tiền hiện có trong dự án",
      estimatedProfitToday: "Lợi nhuận ước tính hôm nay",
      memberCount: (count: number) => `${count} thành viên`,
      settlementSuggestionCount: (count: number) => `${count} gợi ý đối trừ`,
    },
    createProject: {
      pageEyebrow: "Thiết lập workspace",
      pageTitle: "Tạo dự án",
      pageDescription:
        "Khởi tạo workspace thật trên Supabase để team có thể đăng nhập, thêm giao dịch và theo dõi tiền, đối trừ, vốn và lợi nhuận ở một nơi.",
      liveOnboarding: "Khởi tạo live",
      heroTitle: "Tạo dự án live đầu tiên",
      heroDescription:
        "Thao tác này sẽ tạo một dự án thật trên Supabase và thêm bạn vào với vai trò chủ dự án để bạn có thể nhập giao dịch ngay.",
      whatGetsCreated: "Hệ thống sẽ tạo gì",
      whatGetsCreatedDescription:
        "Một bản ghi dự án, một slug duy nhất cho dự án và quyền owner của bạn trong dự án đó.",
      whatNext: "Sau đó bạn có thể làm gì",
      whatNextDescription:
        "Thêm vốn góp, tiền khách hàng, chi phí vận hành, chuyển tiền nội bộ và các khoản hoàn trả ngay từ dashboard dự án.",
      detailsTitle: "Thông tin dự án",
      detailsDescription:
        "Bắt đầu với thông tin cơ bản. Bạn có thể thêm thành viên sau khi dự án được tạo.",
      summary: "Mô tả ngắn",
      summaryPlaceholder:
        "Ví dụ: Mỗi thành viên dùng tài khoản ngân hàng riêng, còn workspace này chỉ theo dõi dòng tiền của dự án.",
    },
    projectPage: {
      eyebrow: "Dashboard dự án",
      fallbackDescription:
        "Giải thích tiền dự án, chi phí chung, vốn góp và lợi nhuận theo cách dễ hiểu.",
    },
    notFound: {
      eyebrow: "Không tìm thấy",
      title: "Trang này không tồn tại",
      description:
        "Link dự án hoặc link thành viên có thể đã cũ. Hãy quay lại workspace để chọn một dự án còn hoạt động.",
      cta: "Về danh sách dự án",
    },
    actions: {
      auth: {
        invalidEmail: "Hãy nhập email hợp lệ.",
        invalidPassword: "Mật khẩu phải có ít nhất 8 ký tự.",
        invalidDisplayName:
          "Hãy nhập tên mà mọi người sẽ nhìn thấy trong workspace.",
        signInFailed: "Không thể đăng nhập.",
        signUpFailed: "Không thể tạo tài khoản.",
        supabaseMissing: "Supabase chưa được cấu hình.",
        demoSignUpUnavailable:
          "Chưa thể tạo tài khoản live vì Supabase chưa được cấu hình.",
        emailVerificationNotice:
          "Tài khoản đã được tạo. Hãy kiểm tra email để xác nhận nếu project Supabase của bạn yêu cầu xác minh email.",
      },
      projects: {
        projectNameMin: "Tên dự án cần có ít nhất 3 ký tự.",
        currencyInvalid: "Hãy chọn mã tiền tệ 3 ký tự hợp lệ.",
        demoBlocked:
          "Không thể tạo dự án trong workspace mẫu. Hãy đăng nhập bằng tài khoản live để tạo dự án thật.",
        createFailed: "Không thể tạo dự án.",
        signInRequired: "Bạn cần đăng nhập trước khi tạo dự án.",
        missingMigration:
          "Database đang thiếu migration mới nhất cho luồng tạo dự án. Hãy apply SQL migration mới nhất trên Supabase rồi thử lại.",
        invalidResponse:
          "Dự án đã được tạo nhưng payload phản hồi trả về không hợp lệ.",
      },
    },
  },
} as const;

export type AppMessages = (typeof messages)["en"];

export function getMessages(locale: keyof typeof messages) {
  return messages[locale];
}
