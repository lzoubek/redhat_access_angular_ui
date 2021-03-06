'use strict';
/*jshint camelcase: false */
angular.module('RedhatAccess.cases').service('AttachmentsService', [
    '$filter',
    '$q',
    'strataService',
    'TreeViewSelectorUtils',
    '$http',
    'securityService',
    'AlertService',
    'CaseService',
    'translate',
    function ($filter, $q, strataService, TreeViewSelectorUtils, $http, securityService, AlertService, CaseService, translate) {
        this.originalAttachments = [];
        this.updatedAttachments = [];
        this.backendAttachments = [];
        this.suggestedArtifact = {};
        this.clear = function () {
            this.originalAttachments = [];
            this.updatedAttachments = [];
            this.backendAttachments = [];
        };
        this.updateBackEndAttachments = function (selected) {
            this.backendAttachments = selected;
        };
        this.hasBackEndSelections = function () {
            return TreeViewSelectorUtils.hasSelections(this.backendAttachments);
        };
        this.removeUpdatedAttachment = function ($index) {
            this.updatedAttachments.splice($index, 1);
        };
        this.removeOriginalAttachment = function ($index) {
            var attachment = this.originalAttachments[$index];
            var progressMessage = AlertService.addWarningMessage(translate('Deleting attachment:') + ' ' + attachment.file_name);
            strataService.cases.attachments.remove(attachment.uuid, CaseService.kase.case_number).then(angular.bind(this, function () {
                AlertService.removeAlert(progressMessage);
                AlertService.addSuccessMessage(translate('Successfully deleted attachment:') + ' ' + attachment.file_name);
                this.originalAttachments.splice($index, 1);
            }), function (error) {
                AlertService.addStrataErrorMessage(error);
            });
        };
        this.addNewAttachment = function (attachment) {
            this.updatedAttachments.push(attachment);
        };
        this.defineOriginalAttachments = function (attachments) {
            if (!angular.isArray(attachments)) {
                this.originalAttachments = [];
            } else {
                this.originalAttachments = attachments;
            }
        };
        this.postBackEndAttachments = function (caseId) {
            var selectedFiles = TreeViewSelectorUtils.getSelectedLeaves(this.backendAttachments);
            return securityService.getBasicAuthToken().then(function (auth) {
                /*jshint unused:false */
                //we post each attachment separately
                var promises = [];
                angular.forEach(selectedFiles, function (file) {
                    var jsonData = {
                            authToken: auth,
                            attachment: file,
                            caseNum: caseId
                        };
                    var deferred = $q.defer();
                    $http.post('attachments', jsonData).success(function (data, status, headers, config) {
                        deferred.resolve(data);
                        AlertService.addSuccessMessage(translate('Successfully uploaded attachment') + ' ' + jsonData.attachment + ' ' + translate('to case') + ' ' + caseId);
                    }).error(function (data, status, headers, config) {
                        var errorMsg = '';
                        switch (status) {
                        case 401:
                            errorMsg = ' : Unauthorised.';
                            break;
                        case 409:
                            errorMsg = ' : Invalid username/password.';
                            break;
                        case 500:
                            errorMsg = ' : Internal server error';
                            break;
                        }
                        AlertService.addDangerMessage('Failed to upload attachment ' + jsonData.attachment + ' to case ' + caseId + errorMsg);
                        deferred.reject(data);
                    });
                    promises.push(deferred.promise);
                });
                return $q.all(promises);
            });
        };
        this.updateAttachments = function (caseId) {
            var hasServerAttachments = this.hasBackEndSelections();
            var hasLocalAttachments = !angular.equals(this.updatedAttachments.length, 0);
            if (hasLocalAttachments || hasServerAttachments) {
                var promises = [];
                var updatedAttachments = this.updatedAttachments;
                if (hasServerAttachments) {
                    promises.push(this.postBackEndAttachments(caseId));
                }
                if (hasLocalAttachments) {
                    //find new attachments
                    angular.forEach(updatedAttachments, function (attachment) {
                        if (!attachment.hasOwnProperty('uuid')) {
                            var promise = strataService.cases.attachments.post(attachment.file, caseId);
                            promise.then(function (uri) {
                                attachment.uri = uri;
                                attachment.uuid = uri.slice(uri.lastIndexOf('/') + 1);
                                AlertService.addSuccessMessage('Successfully uploaded attachment ' + attachment.file_name + ' to case ' + caseId);
                            }, function (error) {
                                AlertService.addStrataErrorMessage(error);
                            });
                            promises.push(promise);
                        }
                    });
                }
                var uploadingAlert = AlertService.addWarningMessage('Uploading attachments...');
                var parentPromise = $q.all(promises);
                parentPromise.then(angular.bind(this, function () {
                    this.originalAttachments = this.originalAttachments.concat(this.updatedAttachments);
                    this.updatedAttachments = [];
                    AlertService.removeAlert(uploadingAlert);
                }), function (error) {
                    AlertService.addStrataErrorMessage(error);
                    AlertService.removeAlert(uploadingAlert);
                });
                return parentPromise;
            }
        };
        this.fetchProductDetail = function (productCode) {
            this.suggestedArtifact = {};
            strataService.products.get(productCode).then(angular.bind(this, function (product) {
                //TODO find some better way of escaping the html
                if (product !== undefined && product.suggested_artifacts !== undefined && product.suggested_artifacts.suggested_artifact !== undefined) {
                    if (product.suggested_artifacts.suggested_artifact.length > 0) {
                        var description = product.suggested_artifacts.suggested_artifact[0].description;
                        var attachmentLink = '';
                        var text = '';
                        var trail = '';
                        this.suggestedArtifact.hasLink = false;
                        if (description.indexOf('<a') > -1) {
                            this.suggestedArtifact.hasLink = true;
                            attachmentLink = description.slice(description.indexOf('\"'),description.lastIndexOf('\"')-12);
                            text = description.slice(0,description.indexOf('<'));
                            trail = description.slice(description.lastIndexOf('>')+1,description.length);
                        } else {
                            text = product.suggested_artifacts.suggested_artifact[0].description;
                        }
                        
                        this.suggestedArtifact.name = product.suggested_artifacts.suggested_artifact[0].name;
                        this.suggestedArtifact.link = attachmentLink;
                        this.suggestedArtifact.description = text;
                        this.suggestedArtifact.trail = trail;
                    }
                }
            }), function (error) {
                AlertService.addStrataErrorMessage(error);
            });
        };

    }
]);