/**
 * DefinitionFilter - Filters and sorts definitions
 * Handles prioritization and hiding of definition entries
 */
class DefinitionFilter {
  constructor() {
    this.filters = {
      deprioritize: [
        /^old variant of/i,
        /^variant of/i,
        /^archaic variant of/i,
        /^ancient variant of/i,
        /^obsolete variant of/i,
        /^classical variant of/i,
        /surname/i,
        /^name/i,
        /^last name/i,
      ],
      hide: [],
      prioritize: [],
    };
  }

  filterAndSortDefinitions(entries) {
    // First, filter out entries we want to hide completely
    const visibleEntries = entries.filter((entry) => {
      return !this.filters.hide.some((pattern) => pattern.test(entry.definition));
    });

    // Then sort entries by priority
    const sorted = visibleEntries.sort((a, b) => {
      const aScore = this.getDefinitionPriority(a.definition);
      const bScore = this.getDefinitionPriority(b.definition);
      return bScore - aScore; // Higher score = higher priority (shown first)
    });


    return sorted;
  }

  getDefinitionPriority(definition) {
    // Check for prioritize patterns (highest priority)
    if (this.filters.prioritize.some((pattern) => pattern.test(definition))) {
      return 100;
    }

    // Check for deprioritize patterns (lowest priority)
    const deprioritized = this.filters.deprioritize.some((pattern) => {
      const matches = pattern.test(definition);
      return matches;
    });
    if (deprioritized) {
      return -100;
    }

    // Default priority (normal definitions)
    return 0;
  }

  // Method to easily add new filter patterns at runtime
  addFilter(type, pattern) {
    if (this.filters[type]) {
      this.filters[type].push(new RegExp(pattern, "i"));
      console.log(`🔧 Added ${type} filter: ${pattern}`);
    } else {
      console.warn(`🔧 Unknown filter type: ${type}. Use 'prioritize', 'deprioritize', or 'hide'`);
    }
  }

  // Method to remove filter patterns
  removeFilter(type, patternString) {
    if (this.filters[type]) {
      const index = this.filters[type].findIndex(
        (pattern) => pattern.source === new RegExp(patternString, "i").source
      );
      if (index > -1) {
        this.filters[type].splice(index, 1);
        console.log(`🔧 Removed ${type} filter: ${patternString}`);
      }
    }
  }

  // Method to view current filters
  getFilters() {
    const filters = {};
    Object.keys(this.filters).forEach((type) => {
      filters[type] = this.filters[type].map((pattern) => pattern.source);
    });
    return filters;
  }
}