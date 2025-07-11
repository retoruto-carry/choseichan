# Missing Unit Tests Report

## Summary
Based on the analysis of the src directory, here are the components that don't have co-located unit tests:

## Domain Services (1 missing)
- ✅ `src/domain/services/ScheduleDomainService.ts` - HAS TEST
- ❌ `src/domain/services/ResponseDomainService.ts` - **MISSING TEST**

## Domain Entities (2 missing)
- ✅ `src/domain/entities/Schedule.ts` - HAS TEST
- ✅ `src/domain/entities/ScheduleDate.ts` - HAS TEST
- ✅ `src/domain/entities/User.ts` - HAS TEST
- ❌ `src/domain/entities/Response.ts` - **MISSING TEST**
- ❌ `src/domain/entities/ResponseStatus.ts` - **MISSING TEST**

## Application Layer

### Use Cases (16 missing)
- ✅ `src/application/usecases/response/SubmitResponseUseCase.ts` - HAS TEST
- ❌ `src/application/usecases/response/GetResponseUseCase.ts` - **MISSING TEST**
- ❌ `src/application/usecases/response/UpdateResponseUseCase.ts` - **MISSING TEST**
- ✅ `src/application/usecases/schedule/CreateScheduleUseCase.ts` - HAS TEST
- ❌ `src/application/usecases/schedule/CloseScheduleUseCase.ts` - **MISSING TEST**
- ❌ `src/application/usecases/schedule/DeadlineReminderUseCase.ts` - **MISSING TEST**
- ❌ `src/application/usecases/schedule/DeleteScheduleUseCase.ts` - **MISSING TEST**
- ❌ `src/application/usecases/schedule/FindSchedulesUseCase.ts` - **MISSING TEST**
- ❌ `src/application/usecases/schedule/GetScheduleSummaryUseCase.ts` - **MISSING TEST**
- ❌ `src/application/usecases/schedule/GetScheduleUseCase.ts` - **MISSING TEST**
- ❌ `src/application/usecases/schedule/ProcessReminderUseCase.ts` - **MISSING TEST**
- ❌ `src/application/usecases/schedule/ReopenScheduleUseCase.ts` - **MISSING TEST**
- ❌ `src/application/usecases/schedule/UpdateScheduleUseCase.ts` - **MISSING TEST**
- ❌ `src/application/usecases/ProcessDeadlineRemindersUseCase.ts` - **MISSING TEST**

### Application Services (1 missing)
- ❌ `src/application/services/NotificationService.ts` - **MISSING TEST**

### Other Application Layer (3 missing)
- ❌ `src/application/dto/ResponseDto.ts` - **MISSING TEST**
- ❌ `src/application/dto/ScheduleDto.ts` - **MISSING TEST**
- ❌ `src/application/mappers/DomainMappers.ts` - **MISSING TEST**

## Infrastructure Layer (5 missing)
- ❌ `src/infrastructure/repositories/d1/response-repository.ts` - **MISSING TEST**
- ❌ `src/infrastructure/repositories/d1/schedule-repository.ts` - **MISSING TEST**
- ❌ `src/infrastructure/repositories/d1/factory.ts` - **MISSING TEST**
- ❌ `src/infrastructure/services/DiscordApiService.ts` - **MISSING TEST**
- ❌ `src/infrastructure/factories/DependencyContainer.ts` - **MISSING TEST**

## Presentation Layer

### Controllers (10 missing)
- ✅ `src/presentation/controllers/CommandController.ts` - HAS TEST
- ❌ `src/presentation/controllers/ButtonInteractionController.ts` - **MISSING TEST**
- ❌ `src/presentation/controllers/CommentController.ts` - **MISSING TEST**
- ❌ `src/presentation/controllers/CreateScheduleController.ts` - **MISSING TEST**
- ❌ `src/presentation/controllers/DisplayController.ts` - **MISSING TEST**
- ❌ `src/presentation/controllers/EditModalController.ts` - **MISSING TEST**
- ❌ `src/presentation/controllers/ModalController.ts` - **MISSING TEST**
- ❌ `src/presentation/controllers/ScheduleController.ts` - **MISSING TEST**
- ❌ `src/presentation/controllers/ScheduleEditController.ts` - **MISSING TEST**
- ❌ `src/presentation/controllers/ScheduleManagementController.ts` - **MISSING TEST**
- ❌ `src/presentation/controllers/VoteController.ts` - **MISSING TEST**

### UI Builders (11 missing)
- ❌ `src/presentation/builders/CommandUIBuilder.ts` - **MISSING TEST**
- ❌ `src/presentation/builders/CommentUIBuilder.ts` - **MISSING TEST**
- ❌ `src/presentation/builders/CreateScheduleUIBuilder.ts` - **MISSING TEST**
- ❌ `src/presentation/builders/DisplayUIBuilder.ts` - **MISSING TEST**
- ❌ `src/presentation/builders/EditModalUIBuilder.ts` - **MISSING TEST**
- ❌ `src/presentation/builders/ModalUIBuilder.ts` - **MISSING TEST**
- ❌ `src/presentation/builders/ResponseUIBuilder.ts` - **MISSING TEST**
- ❌ `src/presentation/builders/ScheduleEditUIBuilder.ts` - **MISSING TEST**
- ❌ `src/presentation/builders/ScheduleManagementUIBuilder.ts` - **MISSING TEST**
- ❌ `src/presentation/builders/ScheduleUIBuilder.ts` - **MISSING TEST**
- ❌ `src/presentation/builders/VoteUIBuilder.ts` - **MISSING TEST**

## Utilities (7 missing)
- ✅ `src/utils/date.ts` - HAS TEST
- ✅ `src/utils/discord.ts` - HAS TEST
- ✅ `src/utils/id.ts` - HAS TEST
- ✅ `src/utils/rate-limiter.ts` - HAS TEST
- ❌ `src/utils/button-id.ts` - **MISSING TEST**
- ❌ `src/utils/discord-webhook.ts` - **MISSING TEST**
- ❌ `src/utils/embeds.ts` - **MISSING TEST**
- ❌ `src/utils/responses.ts` - **MISSING TEST**
- ❌ `src/utils/schedule-updater-v2.ts` - **MISSING TEST**

## Other (1 missing)
- ❌ `src/cron/deadline-reminder.ts` - **MISSING TEST**

## Files Excluded (Type definitions, constants, index files)
- `src/types/discord-api.ts` - Type definitions only
- `src/types/discord.ts` - Type definitions only
- `src/constants/index.ts` - Constants only
- `src/constants/ui.ts` - Constants only
- `src/domain/types/DomainTypes.ts` - Type definitions only
- `src/domain/repositories/interfaces.ts` - Interface definitions only
- `src/presentation/index.ts` - Export index file
- `src/infrastructure/index.ts` - Export index file
- `src/infrastructure/factories/factory.ts` - Simple factory functions
- `src/application/types/ReminderTypes.ts` - Type definitions only

## Test Coverage Summary
- **Total testable files**: 56
- **Files with tests**: 12 (21.4%)
- **Files missing tests**: 54 (78.6%)

## Priority Areas for Testing
1. **Use Cases** - Core business logic (16 files)
2. **Controllers** - User interaction handlers (10 files)
3. **Infrastructure Services** - External integrations (5 files)
4. **Domain Services** - Business rules (1 file)