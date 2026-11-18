# Light POS feature flow

Role, tenant scope, capability, and feature-surface flow for the implemented product.

[Styled HTML version](light-pos-feature-flowchart.html)

```mermaid
flowchart TB
  AUTH(["Sign in"]) --> ROLE{"Resolve role"}
  ROLE -->|Superadmin| SA["All businesses<br/>full surface"]
  ROLE -->|Admin| AD["One tenant<br/>catalogue and operations"]
  ROLE -->|Manager| MG["One or more tenants<br/>reporting and operations"]
  ROLE -->|Cashier| CA["One tenant<br/>service workspace"]
  ROLE -->|Kitchen| KI["One tenant<br/>preparation queue"]
  ROLE -->|Display| DI["One tenant<br/>read-only menu"]

  SA --> SCOPE["Resolve tenant scope<br/>business selector"]
  AD --> SCOPE
  MG --> SCOPE
  CA --> SCOPE
  KI --> SCOPE
  DI --> SCOPE

  SCOPE --> CAP["Resolve capability profile<br/>and menu scope"]
  CAP --> SHELL["Role-scoped shell<br/>navigation · messages · theme"]

  SHELL --> CASHIER["Cashier workspace<br/>• Dashboard and shift<br/>• New order<br/>• Shift and requests<br/>• Notes"]
  SHELL --> SERVICE["Service board<br/>• Orders<br/>• Seats"]
  SHELL --> MANAGER["Manager operations<br/>• Overview and revenue<br/>• Expenses<br/>• Inventory and recipes<br/>• Profitability<br/>• SOP and notes<br/>• Leave approvals"]
  SHELL --> ADMIN["Admin catalogue and operations<br/>• Portfolio and insights<br/>• Menu catalog<br/>• Menu lab and experiments<br/>• Order types · tables · coupons<br/>• Staff and shifts<br/>• Targets and opening hours<br/>• SOP templates<br/>• Payment QR<br/>• Printers and printing<br/>• Users and roles<br/>• Tenants"]
  SHELL --> KITCHEN["Kitchen and display<br/>• Kitchen queue<br/>• Availability<br/>• Display"]

  AXES["Permutation axes<br/>role × tenant scope<br/>role × business mode<br/>role × capability profile<br/>role × viewport<br/>role × theme<br/>role × order status<br/>role × payment method<br/>role × print route<br/>role × menu scope"]
  AXES -.-> ROLE
  AXES -.-> SHELL
```

The flow resolves identity first, then tenant scope, then the capability profile and menu scope. The role-scoped shell exposes only the feature surfaces allowed by that profile. The `Permutation axes` node captures the cross-cutting combinations that change what a user sees or can do.
