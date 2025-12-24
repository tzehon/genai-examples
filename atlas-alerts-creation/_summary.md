Organizations managing multiple MongoDB Atlas projects face a time-consuming challenge: manually implementing the 20+ recommended alert configurations requires cross-referencing documentation, mapping metrics to conditions, and repeating the process for each project. This automation tool solves that problem by allowing teams to define alert configurations once in an Excel spreadsheet and deploy them consistently across any number of Atlas projects in seconds using the [MongoDB Atlas CLI](https://www.mongodb.com/docs/atlas/cli/current/).

**Key Features:**
- Automated deployment of 20+ recommended Atlas alerts from Excel configuration
- Dry-run mode to validate JSON generation before deployment
- Selective deletion of automation-created alerts while preserving Atlas defaults
- Customizable notification emails and role-based alerting
- Duplicate detection to prevent redundant alert creation
- Support for metric-based, event-based, and threshold-based alert types