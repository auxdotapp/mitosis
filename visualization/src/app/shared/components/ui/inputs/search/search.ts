import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {Subject} from 'rxjs/internal/Subject';
import {Subscription} from 'rxjs/internal/Subscription';
import {debounceTime, distinctUntilChanged, map, startWith, switchMap} from 'rxjs/operators';
import {Observable} from 'rxjs';

@Component({
  selector: 'app-search-input',
  templateUrl: './search.html',
  styleUrls: ['./search.scss']
})
export class SearchInputComponent implements OnInit, OnDestroy {
  private searchTerms = new Subject<string>();
  private searchTermsSubscription: Subscription;

  public filteredOptions: Observable<string[]>;
  public query: string;

  @Input()
  placeholder: string;

  @Input()
  public options: string[] = [];

  @Output()
  valueChange: EventEmitter<string>;

  private static saveSearchTerm(searchTerm: string): void {
    localStorage.setItem('mitosis-vis-node-search', searchTerm);
  }

  private static getSearchTerm(): string {
    return localStorage.getItem('mitosis-vis-node-search');
  }

  private static deleteSearchTerm(): void {
     localStorage.removeItem('mitosis-vis-node-search');
  }

  constructor() {
    this.valueChange = new EventEmitter<string>();
  }

  private _filter(value: string): string[] {
    if (!value) {
      return this.options;
    }
    const filterValue = value.toLowerCase();

    return this.options.filter(option => option.toLowerCase().includes(filterValue));
  }

  public searchOnInput(query: string) {
    this.query = query;
    this.searchTerms.next(query);
  }

  public reset() {
    this.query = '';
    this.searchTerms.next(null);
  }

  ngOnDestroy(): void {
    this.searchTermsSubscription.unsubscribe();
  }

  ngOnInit(): void {
    this.filteredOptions = this.valueChange
      .pipe(
        startWith(''),
        map(value => this._filter(value))
      );

    this.searchTermsSubscription =
      this.searchTerms
        .pipe(
          debounceTime(100),        // wait for 300ms pause in events
          distinctUntilChanged(),   // ignore if next search term is same as previous
          map(term => {
              if (term && term.length > 0) {
                this.valueChange.emit(term);
                SearchInputComponent.saveSearchTerm(term);
              } else {
                this.valueChange.emit(null);
                SearchInputComponent.deleteSearchTerm();
              }
              return term || '';
            }
          )
        )
        .subscribe();

    const existingSearchTerm = SearchInputComponent.getSearchTerm();
    if (existingSearchTerm) {
      this.searchOnInput(existingSearchTerm);
    }
  }
}
