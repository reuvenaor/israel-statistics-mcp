# Israel Statistics MCP Server

A **Model Context Protocol (MCP) server** that provides programmatic access to the Israeli Central Bureau of Statistics (CBS) price indices and economic data. Built with TypeScript, this server offers 8 comprehensive tools for retrieving, analyzing, and calculating Israeli economic statistics.

<a href="https://glama.ai/mcp/servers/@reuvenaor/israel-statistics-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@reuvenaor/israel-statistics-mcp/badge" alt="Israel Statistics MCP server" />
</a>

## 🐳 **Installation & Usage**

### **Docker (Recommended)**

```json
// .mcp.json
{
  "israel-statistics-mcp": {
    "command": "docker",
    "args": ["run", "--rm", "-i", "reuvenaor/israel-statistics-mcp:latest"]
  }
}
```

### **NPX**

```json
// .mcp.json
{
  "israel-statistics-mcp": {
    "command": "npx",
    "args": ["@reuvenorg/israel-statistics-mcp"]
  }
}
```

### **Claude Desktop Integration**

```bash
# Quick setup
claude mcp add --scope project israel-statistics-mcp npx @reuvennaor85/israel-statistics-mcp
```

## 🚀 **Features**

### **📊 Comprehensive Economic Data Access**

- **Consumer Price Index (CPI)** - General and detailed price indices
- **Housing Market Index** - Real estate prices with bi-monthly updates
- **Producer Price Indices** - Industrial, exports, and services
- **Specialized Indices** - Construction, agriculture, transportation, and more
- **Price Linkage Calculator** - Inflation adjustment calculations

### **🛡️ Enterprise-Grade Architecture**

- **Type-Safe Validation** - Complete Zod schema validation for all inputs/outputs
- **Rate Limiting** - Built-in protection (5 concurrent operations max)
- **Error Handling** - Comprehensive CBS API error handling and retry logic
- **Multi-Format Support** - JSON and XML response parsing
- **Housing Market Warnings** - Automatic notifications for bi-monthly provisional data

### **🔄 Advanced Data Processing**

- **XML/JSON Transformation** - Seamless conversion from CBS API formats
- **Statistical Calculations** - Automatic averages, counts, and summaries
- **Date Range Filtering** - Flexible period selection (monthly/quarterly)
- **Search & Discovery** - Full-text search across indices and topics
- **Pagination Support** - Handle large datasets efficiently (up to 1000 items/page)

## 📋 **Available MCP Tools**

| Tool                   | Description                                      | Key Parameters                             |
| ---------------------- | ------------------------------------------------ | ------------------------------------------ |
| `get_index_topics`     | Browse all available index categories and topics | `period`, `searchText`, `lang`             |
| `get_catalog_chapters` | Get all index chapters (CPI, Housing, etc.)      | `lang`, `pagesize`                         |
| `get_chapter_topics`   | Get topics within a specific chapter             | `chapterId`, `lang`                        |
| `get_subject_codes`    | Get index codes for a specific topic             | `subjectId`, `searchText`                  |
| `get_index_data`       | Retrieve historical price data for an index      | `code`, `startPeriod`, `endPeriod`         |
| `get_index_calculator` | Calculate inflation-adjusted values              | `indexCode`, `value`, `fromDate`, `toDate` |
| `get_main_indices`     | Get current main economic indices                | `oldFormat`, `lang`                        |
| `get_all_indices`      | Get comprehensive index data with filtering      | `chapter`, `oldFormat`                     |

## 🏗️ **Architecture**

```
src/
├── index.ts                    # MCP server entry point with tool registration
├── mcp/
│   ├── handlers/              # 8 MCP tool handlers
│   │   ├── getIndexTopics.ts     # Browse available indices
│   │   ├── getCatalogChapters.ts # Get index chapters
│   │   ├── getChapterTopics.ts   # Topics by chapter
│   │   ├── getSubjectCodes.ts    # Index codes by topic
│   │   ├── getIndexData.ts       # Historical price data
│   │   ├── getIndexCalculator.ts # Inflation calculator
│   │   ├── getMainIndices.ts     # Main indices (current + by period)
│   │   └── getAllIndices.ts      # All indices with filtering
│   └── helpers/
│       ├── fetcher.ts            # Secure CBS API client with XML/JSON parsing
│       └── housingWarnings.ts    # Housing market data warnings
├── schemas/                   # Type-safe Zod validation schemas
│   ├── request.schema.ts         # Input validation schemas
│   ├── response.schema.ts        # Output validation schemas
│   ├── base.schema.ts           # Reusable object schemas
│   └── shared.schema.ts                # Common enums and types
└── utils/
    ├── registry-security.ts      # Security utilities
    └── spinner.ts               # MCP progress notifications
```

### **🔒 Security Features**

- **Rate Limiting**: Maximum 5 concurrent operations
- **Input Validation**: Comprehensive Zod schema validation
- **URL Validation**: Allowlist-based registry URL security
- **Error Sanitization**: Safe error message handling
- **Timeout Protection**: 30-second HTTP request timeouts

### **📝 Schema Architecture**

## 📊 **CBS API Coverage**

The server implements **complete coverage** of the CBS Israel Statistics API:

### **Index Discovery Endpoints**

- `GET /index/catalog/tree` → `get_index_topics`
- `GET /index/catalog/catalog` → `get_catalog_chapters`
- `GET /index/catalog/chapter` → `get_chapter_topics`
- `GET /index/catalog/subject` → `get_subject_codes`

### **Data Retrieval Endpoints**

- `GET /index/data/price` → `get_index_data`
- `GET /index/data/calculator/{id}` → `get_index_calculator`
- `GET /index/data/price_selected` → `get_main_indices`
- `GET /index/data/price_selected_b` → `get_main_indices_by_period`
- `GET /index/data/price_all` → `get_all_indices`

### **Supported Index Categories**

| Chapter | Description                       | Examples                        |
| ------- | --------------------------------- | ------------------------------- |
| `a`     | Consumer Price Index              | Food, clothing, housing costs   |
| `aa`    | Housing Market Index              | Real estate prices (bi-monthly) |
| `b`     | Producer Price Index - Industrial | Manufacturing output prices     |
| `ba`    | Producer Price Index - Exports    | Export prices for industry      |
| `bb`    | Producer Price Index - Services   | Service industry prices         |
| `c`     | Residential Building Input        | Construction material costs     |
| `ca`    | Commercial Building Input         | Office building costs           |
| `d`     | Road Construction Input           | Infrastructure costs            |
| `e`     | Agriculture Input                 | Agricultural input costs        |
| `f`     | Bus Input                         | Public transportation costs     |
| `fa`    | Public Minibus Input              | Public transport vehicle costs  |

## ⚠️ **Housing Price Index Special Considerations**

The server automatically detects and warns about Housing Price Index data:

- **Bi-monthly Publication**: Updates every 2 months vs. monthly for other indices
- **Temporal Lag**: Data reflects transactions from 2-3 months ago vs. 3-4 months ago
- **Provisional Data**: Last 3 indices may be updated when additional reports arrive
- **Linkage Warnings**: Automatic recommendations against using provisional periods

## 🧪 **Testing & Quality Assurance**

### **Comprehensive Test Suite**

- **Unit Tests**: Complete handler coverage with Vitest
- **Integration Tests**: Real CBS API integration tests
- **Mock Testing**: Isolated handler testing with mocked dependencies
- **Error Handling**: Network error and API error simulation
- **Schema Validation**: Input/output validation testing

### **Code Quality Tools**

- **TypeScript**: Strict type checking with no `any` types
- **ESLint**: Modern flat config with TypeScript rules
- **Prettier**: Consistent code formatting
- **Zod**: Runtime type validation and inference

### **Development Commands**

```bash
# Development
pnpm dev              # Watch mode development
pnpm build           # Production build
pnpm typecheck       # TypeScript validation

# Testing
pnpm test            # Run all tests
pnpm test:dev        # Development mode testing

# Quality
pnpm lint            # Lint code
pnpm lint:fix        # Fix linting issues
pnpm format:check    # Check formatting
pnpm format:write    # Apply formatting

# Docker
docker build -t reuvenaor/israel-statistics-mcp:latest -f Dockerfile .
```

## 🔧 **Development**

### **Project Structure**

- **TypeScript ESM**: Modern ES modules with TypeScript
- **pnpm**: Fast, efficient package management
- **tsup**: Fast TypeScript bundler with ESM output
- **Docker**: Multi-stage builds for optimized containers
- **Vitest**: Fast unit testing framework

### **Key Dependencies**

- `@modelcontextprotocol/sdk`: MCP server implementation
- `zod`: Type-safe validation and schema inference
- `node-fetch`: HTTP client for CBS API calls
- `xml2js`: XML response parsing
- `typescript`: Type system and compilation

### **Configuration Files**

- `tsconfig.json`: TypeScript configuration with strict settings
- `eslint.config.js`: Modern ESLint flat configuration
- `prettier.config.cjs`: Code formatting rules
- `vitest.config.ts`: Test framework configuration
- `tsup.config.ts`: Build tool configuration
- `Dockerfile`: Multi-stage container build

## 📈 **Performance & Scalability**

- **Rate Limiting**: 5 concurrent operations maximum
- **Efficient Parsing**: Optimized XML/JSON transformation
- **Memory Management**: Streaming for large datasets
- **Caching**: Schema validation caching
- **Error Recovery**: Graceful degradation and retry logic

## 📝 **API Response Examples**

### **Index Topics Discovery**

```typescript
// Input
{ lang: "en", searchText: "housing", period: "M" }

// Output
{
  topics: [
    {
      chapterId: "aa",
      chapterName: "Housing Market Index",
      subject: [
        {
          subjectId: 123,
          subjectName: "Apartment Prices",
          code: [
            {
              codeId: 180010,
              codeName: "Housing Price Index - General"
            }
          ]
        }
      ]
    }
  ],
  summary: "Found 15 index codes. ⚠️ Housing Price Index: This is a bi-monthly index..."
}
```

### **Price Linkage Calculation**

```typescript
// Input
{
  indexCode: 120010,
  value: 1000,
  fromDate: "01-01-2020",
  toDate: "01-01-2024"
}

// Output
{
  request: { code: 120010, sum: 1000, from_date: "2020-01-01", to_date: "2024-01-01" },
  answer: {
    from_value: 1000,
    to_value: 1155.2,
    change_percent: 15.52,
    base_year: "2022"
  },
  summary: "Linked 1000 from 2020-01-01 to 2024-01-01: 1155.2 (15.52% change)"
}
```

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 **Links**

- **Repository**: [https://github.com/reuvenaor/israel-statistics-mcp](https://github.com/reuvenaor/israel-statistics-mcp)
- **Docker Hub**: [reuvenaor/israel-statistics-mcp](https://hub.docker.com/r/reuvenaor/israel-statistics-mcp)
- **NPM Package**: [@reuvenorg/israel-statistics-mcp](https://www.npmjs.com/package/@reuvenorg/israel-statistics-mcp)
- **CBS API Documentation**: [Israel Central Bureau of Statistics](https://api.cbs.gov.il/)
- **MCP Protocol**: [Model Context Protocol Specification](https://modelcontextprotocol.io/)

---

**Built with ❤️ for the Israeli tech community and economic research**