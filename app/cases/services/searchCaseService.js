/*jshint camelcase: false*/
'use strict';
angular.module('RedhatAccess.cases').service('SearchCaseService', [
    'CaseService',
    'strataService',
    'AlertService',
    'STATUS',
    'CASE_GROUPS',
    'AUTH_EVENTS',
    '$q',
    '$state',
    '$rootScope',
    'SearchBoxService',
    'securityService',
    function (CaseService, strataService, AlertService, STATUS, CASE_GROUPS, AUTH_EVENTS, $q, $state, $rootScope, SearchBoxService, securityService) {
        this.cases = [];
        this.totalCases = 0;
        this.searching = true;
        this.prefilter = {};
        this.postfilter = {};
        this.start = 0;
        this.count = 100;
        this.total = 0;
        this.allCasesDownloaded = false;
        var getIncludeClosed = function () {
            if (CaseService.status === STATUS.open) {
                return false;
            } else if (CaseService.status === STATUS.closed) {
                return true;
            } else if (CaseService.status === STATUS.both) {
                return true;
            }
            return true;
        };
        this.clear = function () {
            this.cases = [];
            this.oldParams = {};
            SearchBoxService.searchTerm = '';
            this.start = 0;
            this.total = 0;
            this.totalCases = 0;
            this.allCasesDownloaded = false;
            this.prefilter = {};
            this.postfilter = {};
            this.searching = true;
        };
        this.clearPagination = function () {
            this.start = 0;
            this.total = 0;
            this.allCasesDownloaded = false;
            this.cases = [];
        };
        this.oldParams = {};
        this.doFilter = function () {
            if (angular.isFunction(this.prefilter)) {
                this.prefilter();
            }
            if(this.start > 0){
                this.count = this.totalCases - this.start;
            }
            var params = {
                count: this.count,
                include_closed: getIncludeClosed(),
            };
            params.start = this.start;
            var isObjectNothing = function (object) {
                if (object === '' || object === undefined || object === null) {
                    return true;
                } else {
                    return false;
                }
            };
            if (!isObjectNothing(SearchBoxService.searchTerm)) {
                params.keyword = SearchBoxService.searchTerm;
            }
            if (CaseService.group === CASE_GROUPS.manage) {
                $state.go('group');
            } else if (CaseService.group === CASE_GROUPS.ungrouped) {
                params.only_ungrouped = true;
            } else if (!isObjectNothing(CaseService.group)) {
                params.group_numbers = { group_number: [CaseService.group] };
            }
            if (CaseService.status === STATUS.closed) {
                params.status = STATUS.closed;
            }
            if (!isObjectNothing(CaseService.product)) {
                params.product = CaseService.product;
            }
            if (!isObjectNothing(CaseService.owner)) {
                params.owner_ssoname = CaseService.owner;
            }
            if (!isObjectNothing(CaseService.type)) {
                params.type = CaseService.type;
            }
            if (!isObjectNothing(CaseService.severity)) {
                params.severity = CaseService.severity;
            }
            this.searching = true;
            //TODO: hack to get around onchange() firing at page load for each select.
            //Need to prevent initial onchange() event instead of handling here.
            var promises = [];
            var deferred = $q.defer();
            if (!angular.equals(params, this.oldParams)) {
                this.oldParams = params;
                var that = this;
                var cases = null;
                if (securityService.loginStatus.isLoggedIn) {
                    if (securityService.loginStatus.authedUser.sso_username && securityService.loginStatus.authedUser.is_internal) {
                        params.owner_ssoname = securityService.loginStatus.authedUser.sso_username;
                    }
                    cases = strataService.cases.filter(params).then(angular.bind(that, function (response) {
                        that.totalCases = response.total_count;
                        if (response['case'].length + that.total >= that.totalCases) {
                            that.allCasesDownloaded = true;
                        }
                        that.cases = that.cases.concat(response['case']);
                        that.searching = false;
                        that.start = that.start + that.count;
                        that.total = that.total + response['case'].length;
                        if (angular.isFunction(that.postFilter)) {
                            that.postFilter();
                        }
                    }), angular.bind(that, function (error) {
                        AlertService.addStrataErrorMessage(error);
                        that.searching = false;
                    }));
                    deferred.resolve(cases);
                } else {
                    $rootScope.$on(AUTH_EVENTS.loginSuccess, function () {
                        if (securityService.loginStatus.authedUser.sso_username && securityService.loginStatus.authedUser.is_internal) {
                            params.owner_ssoname = securityService.loginStatus.authedUser.sso_username;
                        }
                        cases = strataService.cases.filter(params).then(angular.bind(that, function (response) {
                            that.totalCases = response.total_count;
                            
                            that.cases = that.cases.concat(response['case']);
                            that.searching = false;
                            that.start = that.start + that.count;
                            that.total = that.total + response['case'].length;
                            if (that.total >= that.totalCases) {
                                that.allCasesDownloaded = true;
                            }
                            if (angular.isFunction(that.postFilter)) {
                                that.postFilter();
                            }
                        }), angular.bind(that, function (error) {
                            AlertService.addStrataErrorMessage(error);
                            that.searching = false;
                        }));
                        deferred.resolve(cases);
                    });
                }
                promises.push(deferred.promise);
            } else {
                deferred.resolve();
                promises.push(deferred.promise);
            }
            return $q.all(promises);
        };
    }
]);
